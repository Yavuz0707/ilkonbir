"""API-Football (api-sports.io / RapidAPI) senkronizasyonu.

Ucretsiz plan rate-limited oldugu icin veriler DB'ye yazilir; uygulama hicbir
kullanici isteginde canli API'ye gitmez. Bu modul yalnizca zamanlanmis job ve
/admin/sync tarafindan cagrilir.
"""

import asyncio
import logging

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Club, Coach, LineupSlot, Player, PlayerSeasonStat, Transfer, utcnow

logger = logging.getLogger(__name__)

# API-Football pozisyonlari -> ana kategori
_POSITION_MAP = {"Goalkeeper": "GK", "Defender": "DF", "Midfielder": "MF", "Attacker": "FW"}
_DETAIL_MAP = {"GK": "Kaleci", "DF": "Defans", "MF": "Orta Saha", "FW": "Forvet"}

# football-data.org uzerinden senkron edilen yabanci ligler icin API-Football lig ID'leri
# (yalnizca koc/ID baglama amacli — kulup/kadro sync'i bu liglerde hala football-data.org'dan)
_FOREIGN_LEAGUE_IDS = {39: "Premier League", 140: "La Liga", 78: "Bundesliga", 135: "Serie A", 61: "Ligue 1"}
_CLUB_MATCH_THRESHOLD = 82
_FOREIGN_CLUB_ALIASES: dict[str, str] = {
    "1. FC Köln": "FC Koln",
    "Brighton & Hove Albion FC": "Brighton",
    "Burnley FC": "Burnley",
    "Leeds United FC": "Leeds",
    "Sunderland AFC": "Sunderland",
    "Tottenham Hotspur FC": "Tottenham",
    "West Ham United FC": "West Ham",
    "Wolverhampton Wanderers FC": "Wolves",
    "Club Atlético de Madrid": "Atletico Madrid",
    "Deportivo Alavés": "Alaves",
    "Elche CF": "Elche",
    "Levante UD": "Levante",
    "RCD Espanyol de Barcelona": "Espanyol",
    "Real Oviedo": "Oviedo",
    "Olympique Lyonnais": "Lyon",
    "Olympique de Marseille": "Marseille",
    "Paris Saint-Germain FC": "Paris Saint Germain",
    "Racing Club de Lens": "Lens",
    "Stade Rennais FC 1901": "Rennes",
    "AC Pisa 1909": "Pisa",
    "Bologna FC 1909": "Bologna",
    "Como 1907": "Como",
    "FC Internazionale Milano": "Inter",
    "Parma Calcio 1913": "Parma",
    "US Cremonese": "Cremonese",
    "US Sassuolo Calcio": "Sassuolo",
}
_CLUB_STOPWORDS = {
    "fc", "cf", "afc", "ac", "as", "us", "ud", "rc", "cd", "sv", "sc",
    "club", "calcio", "football", "futbol", "de",
}


def _norm(name: str) -> str:
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return name.translate(replacements).lower().strip()


def _club_key(name: str) -> str:
    clean = (
        _norm(name)
        .replace("&", " ")
        .replace("-", " ")
        .replace(".", " ")
        .replace("'", " ")
    )
    tokens = [
        token
        for token in clean.split()
        if not token.isdigit() and token not in _CLUB_STOPWORDS
    ]
    return " ".join(tokens)


def _club_match_score(api_name: str, club_name: str) -> float:
    target = _club_key(api_name)
    variants = {_club_key(club_name)}
    alias = _FOREIGN_CLUB_ALIASES.get(club_name)
    if alias:
        variants.add(_club_key(alias))

    best = 0.0
    for variant in variants:
        if not variant:
            continue
        tsr = fuzz.token_set_ratio(target, variant)
        plain = fuzz.ratio(target, variant)
        best = max(best, tsr * 0.5 + plain * 0.5)
    return best


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


async def link_and_sync_foreign_coaches(session: AsyncSession, max_coach_requests: int = 90) -> str:
    """football-data.org uzerinden senkron edilmis (yalnizca
    external_football_data_org_id dolu) PL/La Liga/Bundesliga/Serie A/Ligue 1
    kulüplerini API-Football team ID'sine bağlar, sonra /coachs ile teknik
    direktörlerini doldurur.

    API-Football'da kulüp adına göre arama endpoint'i yok; bunun yerine her lig
    için TEK istekle /teams çekilip yerelde fuzzy-match yapılır (96 kulüp için
    böylece sadece 5 istek harcanır, kulüp başına değil).

    `max_coach_requests`: günlük kota aşılmasın diye /coachs çağrı sayısı
    sınırlanır; kalan kulüpler zaten bağlanmış+koçsuz olarak bir sonraki
    çalıştırmada otomatik işlenir (idempotent).
    """
    settings = get_settings()
    if not settings.api_football_key:
        return "API_FOOTBALL_KEY tanimli degil, senkronizasyon atlandi."

    linked = 0
    async with _client() as client:
        for league_id, league_name in _FOREIGN_LEAGUE_IDS.items():
            try:
                teams = await _get(
                    client, "/teams", {"league": league_id, "season": settings.api_football_season}
                )
            except httpx.HTTPError as exc:
                logger.warning("Yabanci lig takim listesi atlandi (%s): %s", league_name, exc)
                await asyncio.sleep(2)
                continue

            candidates = (
                await session.execute(
                    select(Club).where(
                        Club.league == league_name, Club.external_api_football_id.is_(None)
                    )
                )
            ).scalars().all()

            for item in teams:
                team = item["team"]
                best, best_score = None, 0.0
                for c in candidates:
                    cand_norm = _club_key(c.name)
                    # ÖNEMLİ: token_set_ratio TEK BAŞINA kısa API isimlerinde
                    # ("Barcelona") yanılır — o isim, "RCD Espanyol de Barcelona"
                    # gibi alakasız bir kulübün de token alt kümesi olduğu icin
                    # HER ikisine de 100 puan verip aralarinda rastgele secim
                    # yapar (canli olarak Barcelona/Espanyol karisikligina yol
                    # acti). fuzz.ratio (tum string benzerligi) ile agirlikli
                    # ortalama, uzunluk/icerik farkini cezalandirip doğru
                    # (daha yakin) adayı ayirt eder.
                    score = max(
                        _club_match_score(team["name"], c.name),
                        fuzz.token_set_ratio(_club_key(team["name"]), cand_norm) * 0.5
                        + fuzz.ratio(_club_key(team["name"]), cand_norm) * 0.5,
                    )
                    if score > best_score:
                        best, best_score = c, score
                if best is not None and best_score >= _CLUB_MATCH_THRESHOLD:
                    best.external_api_football_id = team["id"]
                    linked += 1
                    candidates.remove(best)

            await session.commit()
            await asyncio.sleep(2)

        # Bağlanmış (external_api_football_id dolu) ama henüz koçsuz kulüpleri
        # işle. ÖNEMLİ: id listesi tutulup her turda session.get() ile taze
        # çekiliyor — bir kulüpte httpx hatası olup rollback tetiklenirse, onceden
        # yuklenmis ORM nesneleri uzerinde devam etmek MissingGreenlet'e yol acar
        # (bkz. transfermarkt.py sync_market_values'taki ayni duzeltme).
        club_ids = (
            await session.execute(
                select(Club.id).where(
                    Club.external_api_football_id.isnot(None),
                    Club.league.in_(list(_FOREIGN_LEAGUE_IDS.values())),
                )
            )
        ).scalars().all()

        coached = coach_calls = 0
        for club_id in club_ids:
            if coach_calls >= max_coach_requests:
                break
            club = await session.get(Club, club_id)
            has_coach = (
                await session.execute(select(Coach.id).where(Coach.club_id == club.id))
            ).scalar_one_or_none()
            if has_coach is not None:
                continue
            try:
                await _sync_coach(client, session, club)
                await session.commit()
                coached += 1
            except httpx.HTTPError as exc:
                logger.warning("Koc senkronu atlandi (%s): %s", club.name, exc)
                await session.rollback()
            coach_calls += 1
            await asyncio.sleep(7)

    return (
        f"{linked} kulüp API-Football ID'sine bağlandı, {coached} koç senkronize edildi "
        f"({coach_calls} istek harcandı, kalanlar bir sonraki çalıştırmada tamamlanır)."
    )
