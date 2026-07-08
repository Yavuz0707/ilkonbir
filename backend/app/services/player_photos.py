"""Player photo backfill helpers.

Slow per-player sources live here so regular sync jobs stay light.
"""

import asyncio
import logging
from datetime import date
from urllib.parse import quote

import httpx
from rapidfuzz import fuzz
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..models import Club, Player, PlayerSeasonStat
from .api_football import _client as api_football_client
from .api_football import _get as api_football_get
from .transfermarkt import _extract_photo_url

logger = logging.getLogger(__name__)

_API_FOOTBALL_MATCH_THRESHOLD = 92
_WIKIDATA_ACCEPT_THRESHOLD = 92
_WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
_USER_AGENT = "ilkonbir-player-photo-backfill/1.0 (https://localhost)"


def _missing_photo_filter(column):
    return or_(column.is_(None), column == "")


def _has_photo(value: str | None) -> bool:
    return bool(value and value.strip())


def _norm(name: str | None) -> str:
    if not name:
        return ""
    replacements = str.maketrans(
        "\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc",
        "cgiosuCGIOSU",
    )
    return (
        name.translate(replacements)
        .lower()
        .replace("&", " ")
        .replace(".", " ")
        .replace("-", " ")
        .strip()
    )


def _name_score(left: str | None, right: str | None) -> float:
    return float(fuzz.token_set_ratio(_norm(left), _norm(right)))


def _accepted_name_match(api_name: str, candidates: list[Player]) -> Player | None:
    scored = sorted(
        ((_name_score(api_name, player.name), player) for player in candidates),
        key=lambda item: item[0],
        reverse=True,
    )
    if not scored:
        return None
    best_score, best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0
    if best_score >= 98 or (
        best_score >= _API_FOOTBALL_MATCH_THRESHOLD and best_score - second_score >= 4
    ):
        return best
    return None


async def player_photo_counts(session: AsyncSession) -> tuple[int, int, int]:
    total = (await session.execute(select(func.count(Player.id)))).scalar_one()
    with_photo = (
        await session.execute(
            select(func.count(Player.id)).where(~_missing_photo_filter(Player.photo_url))
        )
    ).scalar_one()
    return int(total), int(with_photo), int(total - with_photo)


async def propagate_player_photos_to_stats(session: AsyncSession) -> int:
    result = await session.execute(
        update(PlayerSeasonStat)
        .where(
            PlayerSeasonStat.player_id == Player.id,
            _missing_photo_filter(PlayerSeasonStat.photo_url),
            ~_missing_photo_filter(Player.photo_url),
        )
        .values(photo_url=Player.photo_url)
        .execution_options(synchronize_session=False)
    )
    return int(result.rowcount or 0)


async def sync_player_photos_from_api_football(
    session: AsyncSession,
    *,
    delay_seconds: float = 15.0,
    max_clubs: int | None = None,
) -> int:
    """Fill squad photos for every club that has an API-Football team id.

    The Super Lig sync already writes this field. Foreign clubs can get an
    API-Football id during coach linking; this fills photos for their
    football-data.org players via cautious same-club name matching.
    """
    settings = get_settings()
    if not settings.api_football_key:
        return 0

    club_ids = (
        await session.execute(
            select(Club.id)
            .join(Player, Player.club_id == Club.id)
            .where(
                Club.external_api_football_id.isnot(None),
                _missing_photo_filter(Player.photo_url),
            )
            .distinct()
            .order_by(Club.id)
        )
    ).scalars().all()
    if max_clubs is not None:
        club_ids = club_ids[:max_clubs]

    updated = 0
    async with api_football_client() as client:
        for club_id in club_ids:
            club = await session.get(Club, club_id, options=[selectinload(Club.players)])
            if club is None or club.external_api_football_id is None:
                continue
            try:
                squads = await api_football_get(
                    client, "/players/squads", {"team": club.external_api_football_id}
                )
                players = squads[0].get("players", []) if squads else []
                for api_player in players:
                    photo_url = api_player.get("photo")
                    api_id = api_player.get("id")
                    if not photo_url or api_id is None:
                        continue

                    target = next(
                        (
                            player
                            for player in club.players
                            if player.external_api_football_id == api_id
                        ),
                        None,
                    )
                    if target is None:
                        candidates = [
                            player
                            for player in club.players
                            if not _has_photo(player.photo_url)
                        ]
                        target = _accepted_name_match(api_player.get("name") or "", candidates)
                    if target is None or _has_photo(target.photo_url):
                        continue

                    target.photo_url = photo_url
                    if target.external_api_football_id is None:
                        existing_id = (
                            await session.execute(
                                select(Player.id)
                                .where(
                                    Player.external_api_football_id == api_id,
                                    Player.id != target.id,
                                )
                                .limit(1)
                            )
                        ).scalar_one_or_none()
                        if existing_id is None:
                            target.external_api_football_id = int(api_id)
                    updated += 1

                await propagate_player_photos_to_stats(session)
                await session.commit()
            except httpx.HTTPError as exc:
                logger.warning("API-Football foto backfill atlandi (%s): %s", club.name, exc)
                await session.rollback()
            await asyncio.sleep(delay_seconds)

    return updated


async def sync_player_photos_from_transfermarkt_profiles(
    session: AsyncSession,
    *,
    limit: int | None = None,
    delay_seconds: float = 1.0,
) -> int:
    settings = get_settings()
    stmt = (
        select(Player.id)
        .where(Player.transfermarkt_id.isnot(None), _missing_photo_filter(Player.photo_url))
        .order_by(Player.market_value.desc().nulls_last(), Player.id)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    player_ids = (await session.execute(stmt)).scalars().all()

    updated = 0
    async with httpx.AsyncClient(base_url=settings.transfermarkt_api_url, timeout=60) as client:
        for player_id in player_ids:
            player = await session.get(Player, player_id)
            if player is None or player.transfermarkt_id is None or _has_photo(player.photo_url):
                continue
            try:
                resp = await client.get(f"/players/{player.transfermarkt_id}/profile")
                if resp.status_code != 200:
                    continue
                photo_url = _extract_photo_url(resp.json())
                if not photo_url:
                    continue
                player.photo_url = photo_url
                await propagate_player_photos_to_stats(session)
                await session.commit()
                updated += 1
            except httpx.HTTPError as exc:
                logger.warning("Transfermarkt profil foto backfill atlandi (%s): %s", player.name, exc)
                await session.rollback()
            await asyncio.sleep(delay_seconds)

    return updated


def _commons_file_url(value: str) -> str | None:
    if not value:
        return None
    url = value
    if value.startswith("http://") or value.startswith("https://"):
        marker = "/Special:FilePath/"
        if marker in value:
            filename = value.rsplit(marker, 1)[-1]
            url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename}"
    else:
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(value, safe='')}"
    return url if len(url) <= 300 else None


def _birth_years_for_age(age: int | None) -> set[int]:
    if age is None:
        return set()
    year = date.today().year
    return {year - age, year - age - 1}


def _wikidata_candidate_score(player: Player, candidate: dict) -> float:
    label = candidate.get("itemLabel", {}).get("value")
    score = _name_score(player.name, label)

    dob_value = candidate.get("dob", {}).get("value")
    birth_years = _birth_years_for_age(player.age)
    if dob_value and birth_years:
        try:
            if int(dob_value[:4]) not in birth_years:
                return 0
            score += 4
        except ValueError:
            return 0

    country_label = candidate.get("countryLabel", {}).get("value")
    if player.nationality and country_label:
        country_score = _name_score(player.nationality, country_label)
        if country_score >= 90:
            score += 3

    return min(score, 100.0)


async def _wikidata_image_for_player(
    client: httpx.AsyncClient,
    player: Player,
) -> str | None:
    query = """
SELECT ?item ?itemLabel ?image ?dob ?countryLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search "%s";
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  ?item wdt:P106 wd:Q937857;
        wdt:P18 ?image.
  OPTIONAL { ?item wdt:P569 ?dob. }
  OPTIONAL { ?item wdt:P27 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 8
""" % player.name.replace('"', '\\"')
    resp = await client.get(
        _WIKIDATA_ENDPOINT,
        params={"query": query, "format": "json"},
        headers={"Accept": "application/sparql-results+json", "User-Agent": _USER_AGENT},
    )
    resp.raise_for_status()
    bindings = resp.json().get("results", {}).get("bindings", [])
    scored = sorted(
        (
            (_wikidata_candidate_score(player, candidate), candidate)
            for candidate in bindings
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    if not scored:
        return None
    best_score, best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0
    if best_score < _WIKIDATA_ACCEPT_THRESHOLD:
        return None
    if second_score and best_score - second_score < 4 and best_score < 98:
        return None

    image = best.get("image", {}).get("value")
    return _commons_file_url(image) if image else None


async def sync_player_photos_from_wikidata(
    session: AsyncSession,
    *,
    limit: int | None = None,
    offset: int = 0,
    delay_seconds: float = 1.0,
) -> int:
    stmt = (
        select(Player.id)
        .where(_missing_photo_filter(Player.photo_url))
        .order_by(Player.market_value.desc().nulls_last(), Player.id)
    )
    if offset:
        stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)
    player_ids = (await session.execute(stmt)).scalars().all()

    updated = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for player_id in player_ids:
            player = await session.get(Player, player_id)
            if player is None or _has_photo(player.photo_url):
                continue
            try:
                photo_url = await _wikidata_image_for_player(client, player)
                if not photo_url:
                    continue
                player.photo_url = photo_url
                await propagate_player_photos_to_stats(session)
                await session.commit()
                updated += 1
            except httpx.HTTPError as exc:
                logger.warning("Wikidata foto backfill atlandi (%s): %s", player.name, exc)
                await session.rollback()
            await asyncio.sleep(delay_seconds)

    return updated
