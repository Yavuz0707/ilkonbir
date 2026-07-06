"""football-data.org entegrasyonu — API-Football'un ücretsiz planda kilitlediği
güncel sezona (2025-26) erişim için ikinci veri kaynağı.

Yalnızca gol krallığı için kullanılır: `/competitions/{code}/scorers` gol
sayısına göre sıralı döner; yanında bazen `assists` alanı da gelir ama bu alan
sık sık `null`dur VE sıralama asiste göre değildir — yani "en çok asist yapan"
listesi değil, "en golcülerin yan bilgisi"dir. Bunu asist krallığı olarak
sunmak yanıltıcı olur, bu yüzden bilinçli olarak assists=0 yazılır; bu
liglerin Asist Krallığı'nda görünmemesi frontend tarafında ele alınır.
"""

import asyncio
import logging
from datetime import date, datetime, timezone

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..models import Club, LineupSlot, Player, PlayerSeasonStat

logger = logging.getLogger(__name__)

SOURCE = "football_data_org"
_MATCH_THRESHOLD = 82
_CLUB_MATCH_THRESHOLD = 80

# code -> mevcut kod tabanında zaten kullanılan lig görünen adı (bkz.
# frontend/src/utils/leagues.js LEAGUE_IDS) — "Primera Division" gibi
# football-data.org'un kendi adını değil, tutarlılık için bu adları kullan.
_LEAGUE_DISPLAY_NAMES = {
    "PL": "Premier League",
    "PD": "La Liga",
    "BL1": "Bundesliga",
    "SA": "Serie A",
    "FL1": "Ligue 1",
}

# football-data.org pozisyon stringleri -> (ana kategori, Turkce detay etiket).
# Turkce etiketler bilincli: lineup_service.py'nin formasyon slot etiketleriyle
# (orn. "Sol Bek", "Merkez Orta Saha", "Santrfor") ayni sozlugu kullanmasi,
# otomatik ilk onbir kurma mantiginin bu oyuncularda da dogru calismasini saglar.
_POSITION_MAP: dict[str, tuple[str, str]] = {
    "Goalkeeper": ("GK", "Kaleci"),
    "Centre-Back": ("DF", "Stoper"),
    "Left-Back": ("DF", "Sol Bek"),
    "Right-Back": ("DF", "Sağ Bek"),
    "Defence": ("DF", "Defans"),
    "Defensive Midfield": ("MF", "Ön Libero"),
    "Central Midfield": ("MF", "Merkez Orta Saha"),
    "Attacking Midfield": ("MF", "On Numara"),
    "Left Midfield": ("MF", "Sol Orta Saha"),
    "Right Midfield": ("MF", "Sağ Orta Saha"),
    "Midfield": ("MF", "Orta Saha"),
    "Left Winger": ("FW", "Sol Kanat"),
    "Right Winger": ("FW", "Sağ Kanat"),
    "Centre-Forward": ("FW", "Santrfor"),
    "Offence": ("FW", "Forvet"),
}
_DEFAULT_POSITION = ("MF", "Orta Saha")


def _client() -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        base_url=settings.football_data_org_base_url,
        headers={"X-Auth-Token": settings.football_data_org_api_key or ""},
        timeout=30,
    )


def _norm(name: str) -> str:
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return name.translate(replacements).lower().strip()


async def sync_football_data_org_scorers(session: AsyncSession) -> str:
    """Ayarlı competition kodları için güncel sezon gol krallığını çeker."""
    settings = get_settings()
    if not settings.football_data_org_api_key:
        return "FOOTBALL_DATA_ORG_API_KEY yok, senkronizasyon atlandı."

    # Fuzzy eslestirme icin butun oyuncular + kulup adi tek seferde yuklenir
    players = (
        (await session.execute(select(Player).options(selectinload(Player.club)))).scalars().all()
    )

    upserted = 0
    async with _client() as client:
        for code in settings.football_data_org_competition_codes:
            try:
                resp = await client.get(
                    f"/competitions/{code}/scorers",
                    params={"limit": 20, "season": settings.football_data_org_season},
                )
                resp.raise_for_status()
                data = resp.json()
                league_id = data["competition"]["id"]
                league_name = data["competition"]["name"]
                season_year = int(data["season"]["startDate"][:4])

                for row in data.get("scorers", []):
                    await _upsert_fdo_stat(session, row, league_id, league_name, season_year, players)
                    upserted += 1
                await session.commit()
            except httpx.HTTPError as exc:
                logger.warning("football-data.org senkronu atlandı (%s): %s", code, exc)
                await session.rollback()
            # Rate limit: 10 istek/dk. 7 sn bekleyince ~8-9/dk ile guvenli kaliriz.
            await asyncio.sleep(7)

    return f"{upserted} güncel sezon gol kaydı senkronize edildi (football-data.org)."


def _approx_age(birth_date: str | None) -> int | None:
    if not birth_date:
        return None
    try:
        year = int(birth_date[:4])
    except ValueError:
        return None
    return date.today().year - year


async def sync_foreign_clubs(session: AsyncSession) -> str:
    """PL/La Liga/Bundesliga/Serie A/Ligue 1 kulüplerini + kadrolarını çeker.

    Mevcut elle girilmiş 8 seed kulüp (Real Madrid, Barcelona, Arsenal vb.)
    isim+ülke fuzzy-match ile tanınıp GÜNCELLENİR (kadroları tamamen gerçek
    veriyle değiştirilir); geri kalan ~90 kulüp yeni eklenir. Tek istekte bir
    ligin TÜM takım+kadrolarını döndüğü için toplam sadece 5 istek gerekir.

    NOT: Bu endpoint'te koç adı bu plan katmanında hep boş geliyor (plan
    kısıtı) — coach senkronu burada yapılmaz, kulüpler koçsuz kalabilir.
    """
    settings = get_settings()
    if not settings.football_data_org_api_key:
        return "FOOTBALL_DATA_ORG_API_KEY yok, kulüp senkronu atlandı."

    clubs_synced = players_synced = players_removed = 0
    async with _client() as client:
        for code, league_name in _LEAGUE_DISPLAY_NAMES.items():
            try:
                resp = await client.get(
                    f"/competitions/{code}/teams",
                    params={"season": settings.football_data_org_season},
                )
                resp.raise_for_status()
                data = resp.json()

                for team in data.get("teams", []):
                    club = await _match_or_create_club(session, team, league_name)
                    await session.flush()
                    clubs_synced += 1

                    added, removed = await _sync_foreign_squad(session, club, team)
                    players_synced += added
                    players_removed += removed
                await session.commit()
            except httpx.HTTPError as exc:
                logger.warning("football-data.org kulüp senkronu atlandı (%s): %s", code, exc)
                await session.rollback()
            # Rate limit: 10 istek/dk; 5 lig icin toplam 5 istek, 7 sn bekleme yeterince guvenli
            await asyncio.sleep(7)

    return (
        f"{clubs_synced} kulüp, {players_synced} oyuncu senkronize edildi, "
        f"{players_removed} eski (seed) oyuncu kaldırıldı."
    )


async def _match_or_create_club(session: AsyncSession, team: dict, league_name: str) -> Club:
    ext = team["id"]
    club = (
        await session.execute(select(Club).where(Club.external_football_data_org_id == ext))
    ).scalar_one_or_none()

    if club is None:
        # Fdo'ya henuz baglanmamis kulupler icinde fuzzy-match dene — boylece
        # Real Madrid/Arsenal/Barcelona gibi elle girilmis seed kulupler ikilenmez,
        # guncellenir. NOT: seed kulüplerin de external_api_football_id'si DOLU
        # olabilir (seed_data.py'de plasibl bir API-Football ID'si yazilmisti) —
        # o yuzden burada SADECE external_football_data_org_id bos olanlar bakilir.
        candidates = (
            await session.execute(
                select(Club).where(Club.external_football_data_org_id.is_(None))
            )
        ).scalars().all()
        target = _norm(team["name"])
        best, best_score = None, 0.0
        for c in candidates:
            score = fuzz.token_set_ratio(target, _norm(c.name))
            if score > best_score:
                best, best_score = c, score
        club = best if best_score >= _CLUB_MATCH_THRESHOLD else None

    if club is None:
        club = Club(external_football_data_org_id=ext)
        session.add(club)
    else:
        club.external_football_data_org_id = ext

    club.name = team["name"]
    club.short_name = team.get("tla")
    club.logo_url = team.get("crest")
    club.country = (team.get("area") or {}).get("name")
    club.league = league_name
    return club


async def _sync_foreign_squad(session: AsyncSession, club: Club, team: dict) -> tuple[int, int]:
    squad = team.get("squad", [])
    existing = (
        (await session.execute(select(Player).where(Player.club_id == club.id))).scalars().all()
    )

    fdo_ids: set[int] = set()
    count = 0
    for p in squad:
        ext = p.get("id")
        if ext is None:
            continue
        fdo_ids.add(ext)
        player = (
            await session.execute(
                select(Player).where(Player.external_football_data_org_id == ext)
            )
        ).scalar_one_or_none()
        if player is None:
            player = Player(external_football_data_org_id=ext, position="MF", name=p["name"])
            session.add(player)
        role, detail = _POSITION_MAP.get(p.get("position"), _DEFAULT_POSITION)
        player.name = p["name"]
        player.position = role
        player.detail_position = detail
        player.nationality = p.get("nationality")
        player.age = _approx_age(p.get("dateOfBirth"))
        player.club_id = club.id
        count += 1

    # Diff: bu kulupte olup yeni kadroda (fdo id'siyle) olmayanlari kaldir —
    # bunlar ya elle girilmis eski seed oyunculari ya da transfer olup ayrilanlar
    removed = 0
    for player in existing:
        if player.external_football_data_org_id not in fdo_ids:
            await session.execute(
                update(LineupSlot).where(LineupSlot.player_id == player.id).values(player_id=None)
            )
            await session.delete(player)
            removed += 1

    return count, removed


def _best_player_match(name: str, club_name: str | None, players: list[Player]) -> Player | None:
    target = _norm(name)
    best, best_score = None, 0.0
    for p in players:
        score = fuzz.token_set_ratio(target, _norm(p.name))
        if club_name and p.club and score >= _MATCH_THRESHOLD - 10:
            club_score = fuzz.token_set_ratio(_norm(club_name), _norm(p.club.name))
            score = score * 0.75 + club_score * 0.25
        if score > best_score:
            best, best_score = p, score
    return best if best_score >= _MATCH_THRESHOLD else None


async def _upsert_fdo_stat(
    session: AsyncSession,
    row: dict,
    league_id: int,
    league_name: str,
    season: int,
    players: list[Player],
) -> None:
    fp = row.get("player") or {}
    team = row.get("team") or {}
    ext = fp.get("id")
    if ext is None:
        return

    # ÖNEMLİ: select autoflush'i tetiklemesin diye row session'a eklenmeden once yapilir
    existing = (
        await session.execute(
            select(PlayerSeasonStat).where(
                PlayerSeasonStat.external_player_id == ext,
                PlayerSeasonStat.league_id == league_id,
                PlayerSeasonStat.season == season,
                PlayerSeasonStat.source == SOURCE,
            )
        )
    ).scalar_one_or_none()
    linked = _best_player_match(fp.get("name", ""), team.get("name"), players)

    if existing is None:
        existing = PlayerSeasonStat(
            external_player_id=ext, league_id=league_id, season=season, source=SOURCE
        )
        session.add(existing)

    existing.player_id = linked.id if linked else None
    existing.name = (linked.name if linked else None) or fp.get("name") or "?"
    existing.photo_url = linked.photo_url if linked else None
    existing.club_name = team.get("name")
    existing.club_logo = team.get("crest")
    existing.league_name = league_name
    existing.goals = row.get("goals") or 0
    # Bilinçli olarak 0: bu alan gercek "top assists" degil, bkz modul docstring
    existing.assists = 0
    existing.updated_at = datetime.now(timezone.utc)
