"""API-Football (api-sports.io / RapidAPI) senkronizasyonu.

Ucretsiz plan rate-limited oldugu icin veriler DB'ye yazilir; uygulama hicbir
kullanici isteginde canli API'ye gitmez. Bu modul yalnizca zamanlanmis job ve
/admin/sync tarafindan cagrilir.
"""

import asyncio
import logging

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Club, Coach, LineupSlot, Player, PlayerSeasonStat, Transfer, utcnow

logger = logging.getLogger(__name__)

# API-Football pozisyonlari -> ana kategori
_POSITION_MAP = {"Goalkeeper": "GK", "Defender": "DF", "Midfielder": "MF", "Attacker": "FW"}
_DETAIL_MAP = {"GK": "Kaleci", "DF": "Defans", "MF": "Orta Saha", "FW": "Forvet"}


def _client() -> httpx.AsyncClient:
    settings = get_settings()
    if settings.api_football_use_rapidapi:
        base = f"https://{settings.api_football_rapidapi_host}/v3"
        headers = {
            "x-rapidapi-key": settings.api_football_key or "",
            "x-rapidapi-host": settings.api_football_rapidapi_host,
        }
    else:
        base = settings.api_football_base_url
        headers = {"x-apisports-key": settings.api_football_key or ""}
    return httpx.AsyncClient(base_url=base, headers=headers, timeout=30)


async def _get(client: httpx.AsyncClient, path: str, params: dict) -> list:
    resp = await client.get(path, params=params)
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        # Rate limit vb. hatalarda API 200 donup "errors" alanini doldurur
        logger.warning("API-Football hata: %s", data["errors"])
    return data.get("response", [])


async def sync_clubs_and_players(session: AsyncSession) -> str:
    """Ayarli liglerdeki kulupleri, kadrolari ve teknik direktorleri DB'ye yazar."""
    settings = get_settings()
    if not settings.api_football_key:
        return "API_FOOTBALL_KEY tanimli degil, senkronizasyon atlandi."

    clubs_synced = players_synced = players_removed = 0
    async with _client() as client:
        for league_id in settings.league_ids:
            # NOT: Takim listesi season'a bagli (ucretsiz plan: 2022-2024). Kadrolar
            # /players/squads ile sezonsuz/guncel gelir. Bu yuzden season sadece
            # ligdeki takimlari saymak icin kullanilir; kadro verisi gunceldir.
            teams = await _get(
                client, "/teams", {"league": league_id, "season": settings.api_football_season}
            )
            leagues = await _get(
                client, "/leagues", {"id": league_id, "season": settings.api_football_season}
            )
            league_name = leagues[0]["league"]["name"] if leagues else str(league_id)

            for item in teams:
                team = item["team"]
                try:
                    club = (
                        await session.execute(
                            select(Club).where(Club.external_api_football_id == team["id"])
                        )
                    ).scalar_one_or_none()
                    if club is None:
                        club = Club(external_api_football_id=team["id"])
                        session.add(club)
                    club.name = team["name"]
                    club.short_name = team.get("code")
                    club.logo_url = team.get("logo")
                    club.country = team.get("country")
                    club.league = league_name
                    await session.flush()
                    clubs_synced += 1

                    added, removed = await _sync_squad(client, session, club)
                    players_synced += added
                    players_removed += removed
                    await _sync_coach(client, session, club)
                    await session.commit()
                except httpx.HTTPError as exc:
                    # Bir takimda rate-limit/hata olursa tum sync'i cokertme
                    logger.warning("Takim senkronizasyonu atlandi (%s): %s", team.get("name"), exc)
                    await session.rollback()
                # Rate limit: ucretsiz plan 10 istek/dk. Takim basina 2 istek
                # (squad+coach) atiliyor; 15 sn bekleyince ~8 istek/dk ile limitin
                # altinda kalinir. (12 sn tam 10/dk yapip zaman zaman 429 aliyordu.)
                await asyncio.sleep(15)

    return (
        f"{clubs_synced} kulup, {players_synced} oyuncu senkronize edildi, "
        f"{players_removed} ayrilan oyuncu kaldirildi."
    )


async def _sync_squad(
    client: httpx.AsyncClient, session: AsyncSession, club: Club
) -> tuple[int, int]:
    """Kulubun kadrosunu API'den gelenle TAM eslitler.

    Doner: (eklenen/guncellenen oyuncu sayisi, kaldirilan oyuncu sayisi).
    Artik kadroda olmayan (transfer olmus) oyuncular DB'den silinir; once
    varsa dizilis slotlarindaki referanslari bosaltilir.
    """
    squads = await _get(client, "/players/squads", {"team": club.external_api_football_id})
    if not squads:
        return 0, 0

    # Silme diff'i icin: sync oncesi bu kulupte kayitli oyuncular
    existing = (
        (await session.execute(select(Player).where(Player.club_id == club.id))).scalars().all()
    )

    api_ids: set[int] = set()
    count = 0
    for p in squads[0].get("players", []):
        api_ids.add(p["id"])
        player = (
            await session.execute(
                select(Player).where(Player.external_api_football_id == p["id"])
            )
        ).scalar_one_or_none()
        if player is None:
            player = Player(external_api_football_id=p["id"], position="MF", name=p["name"])
            session.add(player)
        role = _POSITION_MAP.get(p.get("position"), "MF")
        player.name = p["name"]
        player.photo_url = p.get("photo")
        player.position = role
        player.detail_position = _DETAIL_MAP[role]
        player.age = p.get("age")
        player.jersey_number = p.get("number")
        player.club_id = club.id
        count += 1

    # Diff: API kadrosunda artik olmayan eski oyunculari kaldir
    removed = 0
    for player in existing:
        if player.external_api_football_id not in api_ids:
            await session.execute(
                update(LineupSlot)
                .where(LineupSlot.player_id == player.id)
                .values(player_id=None)
            )
            await session.delete(player)
            removed += 1

    return count, removed


async def _sync_coach(client: httpx.AsyncClient, session: AsyncSession, club: Club) -> None:
    coaches = await _get(client, "/coachs", {"team": club.external_api_football_id})
    current = next((c for c in coaches if not c.get("career") or _is_current(c, club)), None)
    if current is None and coaches:
        current = coaches[0]
    if current is None:
        return
    coach = (
        await session.execute(select(Coach).where(Coach.club_id == club.id))
    ).scalar_one_or_none()
    if coach is None:
        coach = Coach(club_id=club.id, name=current["name"])
        session.add(coach)
    coach.external_id = current.get("id")
    coach.name = current.get("name") or coach.name
    coach.photo_url = current.get("photo")
    coach.nationality = current.get("nationality")


def _is_current(coach_item: dict, club: Club) -> bool:
    for spell in coach_item.get("career", []):
        team = spell.get("team") or {}
        if team.get("id") == club.external_api_football_id and spell.get("end") is None:
            return True
    return False


async def sync_top_stats(session: AsyncSession, skip_existing: bool = True) -> str:
    """Gol/asist krallığı (API-Football topscorers/topassists).

    stat_league_ids × stat_seasons kombinasyonlarını çeker (ulusal ligler +
    UEFA kupaları). `skip_existing` True ise DB'de zaten olan (lig,sezon)
    kombinasyonlarını atlar (kota tasarrufu).

    NOT: Ücretsiz plan sezon 2022-2024 verdiği için en yeni sezon 2024 (2024-25).
    """
    settings = get_settings()
    if not settings.api_football_key:
        return "API_FOOTBALL_KEY yok, top stats atlandı."

    upserted = 0
    async with _client() as client:
        for league_id in settings.stat_league_ids:
            for season in settings.stat_seasons:
                if skip_existing:
                    exists = (
                        await session.execute(
                            select(PlayerSeasonStat.id)
                            .where(
                                PlayerSeasonStat.league_id == league_id,
                                PlayerSeasonStat.season == season,
                            )
                            .limit(1)
                        )
                    ).scalar_one_or_none()
                    if exists is not None:
                        continue
                for endpoint in ("/players/topscorers", "/players/topassists"):
                    try:
                        rows = await _get(
                            client, endpoint, {"league": league_id, "season": season}
                        )
                        for item in rows:
                            await _upsert_stat(session, item, league_id, season)
                            upserted += 1
                        await session.commit()
                    except Exception as exc:  # noqa: BLE001 — bir lig/sezon patlarsa digerleri devam
                        logger.warning(
                            "Top stats atlandı (%s lig %s sezon %s): %s",
                            endpoint, league_id, season, exc,
                        )
                        await session.rollback()
                    await asyncio.sleep(15)

    return f"{upserted} gol/asist kaydı senkronize edildi."


async def _upsert_stat(session: AsyncSession, item: dict, league_id: int, season: int) -> None:
    p = item.get("player") or {}
    stats = item.get("statistics") or [{}]
    st = stats[0]
    ext = p.get("id")
    if ext is None:
        return
    # ÖNEMLİ: Tüm SELECT'ler, yeni row session'a eklenmeden ÖNCE yapilir.
    # Aksi halde SELECT autoflush'i tetikler ve henuz doldurulmamis (name=null)
    # row flush edilmeye calisilir -> NotNullViolation.
    linked = (
        await session.execute(
            select(Player).where(Player.external_api_football_id == ext)
        )
    ).scalar_one_or_none()
    row = (
        await session.execute(
            select(PlayerSeasonStat).where(
                PlayerSeasonStat.external_player_id == ext,
                PlayerSeasonStat.league_id == league_id,
                PlayerSeasonStat.season == season,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = PlayerSeasonStat(external_player_id=ext, league_id=league_id, season=season)
        session.add(row)

    team = st.get("team") or {}
    goals = st.get("goals") or {}
    cards = st.get("cards") or {}
    league = st.get("league") or {}
    row.player_id = linked.id if linked else None
    row.name = (linked.name if linked else None) or p.get("name") or row.name or "?"
    row.photo_url = (linked.photo_url if linked else None) or p.get("photo")
    row.club_name = team.get("name")
    row.club_logo = team.get("logo")
    row.league_name = league.get("name")
    row.goals = goals.get("total") or 0
    row.assists = goals.get("assists") or 0
    row.yellow_cards = cards.get("yellow") or 0
    row.red_cards = cards.get("red") or 0
    row.updated_at = utcnow()


async def sync_transfers(session: AsyncSession, since: str = "2024-07-01") -> str:
    """Senkronize edilen kulüplerin son transferlerini saklar (/transfers).

    Tüm tarihçe yerine `since` tarihinden yeni olanlar tutulur (tablo şişmesin).
    """
    settings = get_settings()
    if not settings.api_football_key:
        return "API_FOOTBALL_KEY yok, transfer sync atlandı."

    # Yalnizca gercek (API'den senkron) oyuncusu olan kulupler
    club_rows = (
        await session.execute(
            select(Club.external_api_football_id, Club.id)
            .join(Player, Player.club_id == Club.id)
            .where(
                Club.external_api_football_id.isnot(None),
                Player.external_api_football_id.isnot(None),
            )
            .distinct()
        )
    ).all()

    stored = 0
    async with _client() as client:
        for ext_team_id, _club_id in club_rows:
            try:
                rows = await _get(client, "/transfers", {"team": ext_team_id})
                for item in rows:
                    stored += await _store_transfers(session, item, since)
                await session.commit()
            except httpx.HTTPError as exc:
                logger.warning("Transfer sync atlandı (team %s): %s", ext_team_id, exc)
                await session.rollback()
            await asyncio.sleep(15)

    return f"{stored} transfer kaydı saklandı (>= {since})."


async def _store_transfers(session: AsyncSession, item: dict, since: str) -> int:
    player = item.get("player") or {}
    ext = player.get("id")
    if ext is None:
        return 0
    linked = (
        await session.execute(select(Player.id).where(Player.external_api_football_id == ext))
    ).scalar_one_or_none()

    stored = 0
    for tr in item.get("transfers", []):
        date = tr.get("date")
        if not date or date < since:
            continue
        teams = tr.get("teams") or {}
        to_club = (teams.get("in") or {}).get("name")
        from_club = (teams.get("out") or {}).get("name")
        exists = (
            await session.execute(
                select(Transfer.id).where(
                    Transfer.external_player_id == ext,
                    Transfer.transfer_date == date,
                    Transfer.to_club == to_club,
                )
            )
        ).scalar_one_or_none()
        if exists is not None:
            continue
        session.add(
            Transfer(
                external_player_id=ext,
                player_id=linked,
                player_name=player.get("name") or "?",
                from_club=from_club,
                to_club=to_club,
                transfer_date=date,
                fee=tr.get("type"),
            )
        )
        stored += 1
    return stored
