"""World Cup data service with provider fallback.

Provider priority for 2026 live data:
1. football-data.org
2. openfootball/worldcup.json (no-key public JSON fallback)
3. API-Football
4. empty local response

History data stays local JSON and does not depend on live providers.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

from ..config import get_settings
from .api_football import _client as _api_football_client
from .football_data_org import _client as _fdo_client

logger = logging.getLogger(__name__)

WORLD_CUP_LEAGUE_ID = 1
WORLD_CUP_SEASON = 2026
SOURCE = "world_cup_fallback"
FDO_CODE = "WC"
OPENFOOTBALL_URL = (
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
)

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_CACHE_DIR = _DATA_DIR / "cache" / "world_cup"
_HISTORY_PATH = _DATA_DIR / "world_cup_winners.json"

_API_FOOTBALL_PATHS = {
    "standings": "/standings",
    "fixtures": "/fixtures",
    "rounds": "/fixtures/rounds",
    "topscorers": "/players/topscorers",
    "topassists": "/players/topassists",
    "teams": "/teams",
}

_TTL_SECONDS = {
    "standings": 60 * 60 * 3,
    "fixtures": 60 * 30,
    "rounds": 60 * 60 * 6,
    "topscorers": 60 * 60,
    "topassists": 60 * 60,
    "teams": 60 * 60 * 12,
}
_NEGATIVE_TTL_SECONDS = 60 * 15

_EMPTY_MESSAGES = {
    "standings": "Bu veri henüz yayınlanmadı.",
    "fixtures": "Bu veri henüz yayınlanmadı.",
    "rounds": "Turnuva ilerledikçe burada görünecek.",
    "topscorers": "Turnuva ilerledikçe burada görünecek.",
    "topassists": "Turnuva ilerledikçe burada görünecek.",
    "teams": "Bu veri henüz yayınlanmadı.",
}


class ProviderUnavailable(Exception):
    def __init__(self, provider: str, reason: str):
        super().__init__(reason)
        self.provider = provider
        self.reason = reason


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cache_path(endpoint: str) -> Path:
    return _CACHE_DIR / f"{endpoint}_{WORLD_CUP_SEASON}.json"


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_fresh(payload: dict[str, Any], endpoint: str) -> bool:
    fetched_at = payload.get("fetched_at")
    if not fetched_at:
        return False
    try:
        fetched = datetime.fromisoformat(str(fetched_at).replace("Z", "+00:00"))
    except ValueError:
        return False
    ttl = _TTL_SECONDS.get(endpoint, 60 * 60)
    if not payload.get("has_data"):
        ttl = min(ttl, _NEGATIVE_TTL_SECONDS)
    return _now() - fetched < timedelta(seconds=ttl)


def _has_data(endpoint: str, payload: dict[str, Any]) -> bool:
    key = _normalized_key(endpoint)
    return bool(payload.get(key))


def _normalized_key(endpoint: str) -> str:
    return {
        "standings": "groups",
        "fixtures": "fixtures",
        "rounds": "rounds",
        "topscorers": "players",
        "topassists": "players",
        "teams": "teams",
    }[endpoint]


def _base_payload(endpoint: str, provider: str | None = None) -> dict[str, Any]:
    return {
        "endpoint": endpoint,
        "source": provider or SOURCE,
        "league_id": WORLD_CUP_LEAGUE_ID,
        "season": WORLD_CUP_SEASON,
        "cached": False,
        "fetched_at": _now().isoformat(),
        "api_errors": None,
        "provider_errors": [],
        "message": None,
        "has_data": False,
        "response": [],
        "groups": [],
        "fixtures": [],
        "rounds": [],
        "players": [],
        "teams": [],
    }


def _empty_payload(endpoint: str, provider_errors: list[dict[str, str]] | None = None) -> dict[str, Any]:
    payload = _base_payload(endpoint)
    payload["message"] = _EMPTY_MESSAGES.get(endpoint, "Veri şu anda alınamıyor, daha sonra tekrar deneyin.")
    payload["provider_errors"] = provider_errors or []
    payload["fetched_at"] = _now().isoformat()
    return payload


def _finalize(endpoint: str, provider: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = _base_payload(endpoint, provider)
    payload.update(data)
    payload["has_data"] = _has_data(endpoint, payload)
    if not payload["has_data"]:
        payload["message"] = payload.get("message") or _EMPTY_MESSAGES.get(endpoint)
    return payload


async def fetch_world_cup(endpoint: str) -> dict[str, Any]:
    if endpoint not in _API_FOOTBALL_PATHS:
        raise ValueError(f"Unsupported World Cup endpoint: {endpoint}")

    cached = _read_json(_cache_path(endpoint))
    if cached and _is_fresh(cached, endpoint):
        return {**cached, "cached": True}

    provider_errors: list[dict[str, str]] = []
    for provider_name, fetcher in (
        ("football_data_org", _fetch_fdo),
        ("openfootball", _fetch_openfootball),
        ("api_football", _fetch_api_football),
    ):
        try:
            payload = await fetcher(endpoint)
            if _has_data(endpoint, payload):
                payload["provider_errors"] = provider_errors
                _write_json(_cache_path(endpoint), payload)
                return payload
            provider_errors.append({"provider": provider_name, "reason": "empty_response"})
        except ProviderUnavailable as exc:
            provider_errors.append({"provider": exc.provider, "reason": exc.reason})
            logger.info("World Cup provider skipped (%s/%s): %s", endpoint, exc.provider, exc.reason)

    payload = _empty_payload(endpoint, provider_errors)
    _write_json(_cache_path(endpoint), payload)
    return payload


async def _fetch_fdo(endpoint: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.football_data_org_api_key:
        raise ProviderUnavailable("football_data_org", "missing_api_key")

    try:
        async with _fdo_client() as client:
            if endpoint == "standings":
                data = await _fdo_get(client, f"/competitions/{FDO_CODE}/standings", {"season": WORLD_CUP_SEASON})
                groups = _fdo_standings(data)
                if len(groups) < 2:
                    matches = await _fdo_get(client, f"/competitions/{FDO_CODE}/matches", {"season": WORLD_CUP_SEASON})
                    groups = _standings_from_fixtures(_fdo_fixtures(matches))
                return _finalize(endpoint, "football_data_org", {"groups": groups})
            if endpoint == "fixtures":
                data = await _fdo_get(client, f"/competitions/{FDO_CODE}/matches", {"season": WORLD_CUP_SEASON})
                return _finalize(endpoint, "football_data_org", {"fixtures": _fdo_fixtures(data)})
            if endpoint == "rounds":
                data = await _fdo_get(client, f"/competitions/{FDO_CODE}/matches", {"season": WORLD_CUP_SEASON})
                fixtures = _fdo_fixtures(data)
                return _finalize(endpoint, "football_data_org", {"rounds": _rounds_from_fixtures(fixtures)})
            if endpoint == "topscorers":
                data = await _fdo_get(
                    client,
                    f"/competitions/{FDO_CODE}/scorers",
                    {"season": WORLD_CUP_SEASON, "limit": 50},
                )
                return _finalize(endpoint, "football_data_org", {"players": _fdo_leaders(data)})
            if endpoint == "topassists":
                data = await _fdo_get(
                    client,
                    f"/competitions/{FDO_CODE}/scorers",
                    {"season": WORLD_CUP_SEASON, "limit": 100},
                )
                leaders = [row for row in _fdo_leaders(data) if row.get("assists", 0) > 0]
                leaders.sort(key=lambda row: (row.get("assists") or 0, row.get("goals") or 0), reverse=True)
                return _finalize(endpoint, "football_data_org", {"players": leaders[:30]})
            if endpoint == "teams":
                data = await _fdo_get(client, f"/competitions/{FDO_CODE}/teams", {"season": WORLD_CUP_SEASON})
                return _finalize(endpoint, "football_data_org", {"teams": _fdo_teams(data)})
    except httpx.HTTPStatusError as exc:
        raise ProviderUnavailable("football_data_org", _status_reason(exc.response.status_code)) from exc
    except httpx.HTTPError as exc:
        raise ProviderUnavailable("football_data_org", f"network_error:{type(exc).__name__}") from exc

    raise ProviderUnavailable("football_data_org", "unsupported_endpoint")


async def _fdo_get(client: httpx.AsyncClient, path: str, params: dict[str, Any]) -> dict[str, Any]:
    resp = await client.get(path, params=params)
    resp.raise_for_status()
    return resp.json()


def _status_reason(status_code: int) -> str:
    if status_code == 401:
        return "unauthorized_or_missing_key"
    if status_code == 404:
        return "not_found"
    if status_code == 429:
        return "rate_limited"
    return f"http_{status_code}"


def _fdo_standings(data: dict[str, Any]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for block in data.get("standings") or []:
        if block.get("type") != "TOTAL":
            continue
        name = _clean_stage(block.get("group") or block.get("stage") or "Puan Durumu")
        rows = []
        for item in block.get("table") or []:
            team = item.get("team") or {}
            rows.append(
                {
                    "rank": item.get("position"),
                    "team_id": team.get("id"),
                    "team_name": team.get("shortName") or team.get("name") or "-",
                    "team_logo": team.get("crest"),
                    "played": item.get("playedGames") or 0,
                    "won": item.get("won") or 0,
                    "drawn": item.get("draw") or 0,
                    "lost": item.get("lost") or 0,
                    "goals_for": item.get("goalsFor") or 0,
                    "goals_against": item.get("goalsAgainst") or 0,
                    "goal_difference": item.get("goalDifference") or 0,
                    "points": item.get("points") or 0,
                }
            )
        if rows:
            groups.append({"group": name, "rows": rows})
    return groups


def _fdo_fixtures(data: dict[str, Any]) -> list[dict[str, Any]]:
    fixtures = []
    for item in data.get("matches") or []:
        home = item.get("homeTeam") or {}
        away = item.get("awayTeam") or {}
        score = item.get("score") or {}
        full_time = score.get("fullTime") or {}
        fixtures.append(
            {
                "id": item.get("id"),
                "date": item.get("utcDate"),
                "round": _clean_stage(item.get("group") or item.get("stage") or f"Matchday {item.get('matchday') or ''}"),
                "status": _clean_status(item.get("status")),
                "status_short": item.get("status"),
                "venue": None,
                "home_team": home.get("shortName") or home.get("name"),
                "home_logo": home.get("crest"),
                "away_team": away.get("shortName") or away.get("name"),
                "away_logo": away.get("crest"),
                "home_goals": full_time.get("home"),
                "away_goals": full_time.get("away"),
            }
        )
    return fixtures


def _fdo_leaders(data: dict[str, Any]) -> list[dict[str, Any]]:
    players = []
    for item in data.get("scorers") or []:
        player = item.get("player") or {}
        team = item.get("team") or {}
        players.append(
            {
                "player_id": player.get("id"),
                "name": player.get("name") or "-",
                "photo_url": None,
                "team_name": team.get("shortName") or team.get("name"),
                "team_logo": team.get("crest"),
                "goals": item.get("goals") or 0,
                "assists": item.get("assists") or 0,
                "appearances": item.get("playedMatches"),
            }
        )
    return players


def _fdo_teams(data: dict[str, Any]) -> list[dict[str, Any]]:
    teams = []
    for team in data.get("teams") or []:
        teams.append(
            {
                "id": team.get("id"),
                "name": team.get("shortName") or team.get("name") or "-",
                "code": team.get("tla"),
                "country": (team.get("area") or {}).get("name"),
                "logo_url": team.get("crest"),
            }
        )
    return teams


async def _fetch_openfootball(endpoint: str) -> dict[str, Any]:
    if endpoint not in {"fixtures", "rounds", "standings", "topscorers", "teams"}:
        raise ProviderUnavailable("openfootball", "unsupported_endpoint")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(OPENFOOTBALL_URL)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise ProviderUnavailable("openfootball", _status_reason(exc.response.status_code)) from exc
    except httpx.HTTPError as exc:
        raise ProviderUnavailable("openfootball", f"network_error:{type(exc).__name__}") from exc
    except json.JSONDecodeError as exc:
        raise ProviderUnavailable("openfootball", "invalid_json") from exc

    matches = data.get("matches") or []
    if endpoint == "fixtures":
        return _finalize(endpoint, "openfootball", {"fixtures": _openfootball_fixtures(matches)})
    if endpoint == "rounds":
        return _finalize(endpoint, "openfootball", {"rounds": _rounds_from_fixtures(_openfootball_fixtures(matches))})
    if endpoint == "standings":
        return _finalize(endpoint, "openfootball", {"groups": _openfootball_standings(matches)})
    if endpoint == "topscorers":
        return _finalize(endpoint, "openfootball", {"players": _openfootball_scorers(matches)})
    if endpoint == "teams":
        return _finalize(endpoint, "openfootball", {"teams": _openfootball_teams(matches)})
    raise ProviderUnavailable("openfootball", "unsupported_endpoint")


def _openfootball_fixtures(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fixtures = []
    for index, item in enumerate(matches):
        score = item.get("score") or {}
        full_time = score.get("ft") or []
        home_goals = full_time[0] if len(full_time) > 0 else None
        away_goals = full_time[1] if len(full_time) > 1 else None
        fixtures.append(
            {
                "id": index + 1,
                "date": _openfootball_date(item),
                "round": item.get("group") or item.get("round"),
                "status": "Bitti" if home_goals is not None and away_goals is not None else "Oynanmadi",
                "status_short": "FINISHED" if home_goals is not None and away_goals is not None else "SCHEDULED",
                "venue": item.get("ground"),
                "home_team": item.get("team1"),
                "home_logo": None,
                "away_team": item.get("team2"),
                "away_logo": None,
                "home_goals": home_goals,
                "away_goals": away_goals,
            }
        )
    return fixtures


def _openfootball_date(item: dict[str, Any]) -> str | None:
    date = item.get("date")
    if not date:
        return None
    time = str(item.get("time") or "").split(" ")[0]
    if time and ":" in time:
        return f"{date}T{time}:00"
    return date


def _openfootball_teams(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    names = sorted({name for item in matches for name in (item.get("team1"), item.get("team2")) if name})
    return [{"id": None, "name": name, "code": None, "country": name, "logo_url": None} for name in names]


def _openfootball_scorers(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    goals: dict[tuple[str, str], int] = defaultdict(int)
    for item in matches:
        for key, team_key in (("goals1", "team1"), ("goals2", "team2")):
            team = item.get(team_key)
            for goal in item.get(key) or []:
                name = goal.get("name")
                if name:
                    goals[(name, team or "")] += 1
    rows = [
        {
            "player_id": None,
            "name": name,
            "photo_url": None,
            "team_name": team or None,
            "team_logo": None,
            "goals": count,
            "assists": 0,
            "appearances": None,
        }
        for (name, team), count in goals.items()
    ]
    rows.sort(key=lambda row: (row["goals"], row["name"]), reverse=True)
    return rows[:30]


def _openfootball_standings(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tables: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for item in matches:
        group = item.get("group")
        score = item.get("score") or {}
        full_time = score.get("ft") or []
        if not group or len(full_time) < 2:
            continue
        home, away = item.get("team1"), item.get("team2")
        if not home or not away:
            continue
        home_goals, away_goals = full_time[0], full_time[1]
        _apply_table_result(tables[group], home, home_goals, away_goals)
        _apply_table_result(tables[group], away, away_goals, home_goals)

    groups = []
    for group, table in sorted(tables.items()):
        rows = list(table.values())
        rows.sort(key=lambda row: (row["points"], row["goal_difference"], row["goals_for"], row["team_name"]), reverse=True)
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        groups.append({"group": group, "rows": rows})
    return groups


def _standings_from_fixtures(fixtures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tables: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for fixture in fixtures:
        group = fixture.get("round")
        if not group or "group" not in str(group).lower():
            continue
        home, away = fixture.get("home_team"), fixture.get("away_team")
        home_goals, away_goals = fixture.get("home_goals"), fixture.get("away_goals")
        if home is None or away is None or home_goals is None or away_goals is None:
            continue
        _apply_table_result(tables[group], home, int(home_goals), int(away_goals))
        _apply_table_result(tables[group], away, int(away_goals), int(home_goals))

    groups = []
    for group, table in sorted(tables.items()):
        rows = list(table.values())
        rows.sort(key=lambda row: (row["points"], row["goal_difference"], row["goals_for"], row["team_name"]), reverse=True)
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        groups.append({"group": group, "rows": rows})
    return groups


def _apply_table_result(table: dict[str, dict[str, Any]], name: str, goals_for: int, goals_against: int) -> None:
    row = table.setdefault(
        name,
        {
            "rank": None,
            "team_id": None,
            "team_name": name,
            "team_logo": None,
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goals_for": 0,
            "goals_against": 0,
            "goal_difference": 0,
            "points": 0,
        },
    )
    row["played"] += 1
    row["goals_for"] += goals_for
    row["goals_against"] += goals_against
    row["goal_difference"] = row["goals_for"] - row["goals_against"]
    if goals_for > goals_against:
        row["won"] += 1
        row["points"] += 3
    elif goals_for == goals_against:
        row["drawn"] += 1
        row["points"] += 1
    else:
        row["lost"] += 1


async def _fetch_api_football(endpoint: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.api_football_key:
        raise ProviderUnavailable("api_football", "missing_api_key")

    path = _API_FOOTBALL_PATHS[endpoint]
    try:
        async with _api_football_client() as client:
            resp = await client.get(path, params={"league": WORLD_CUP_LEAGUE_ID, "season": WORLD_CUP_SEASON})
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise ProviderUnavailable("api_football", _status_reason(exc.response.status_code)) from exc
    except httpx.HTTPError as exc:
        raise ProviderUnavailable("api_football", f"network_error:{type(exc).__name__}") from exc

    if data.get("errors"):
        raise ProviderUnavailable("api_football", "provider_restriction")

    raw_payload = {"response": data.get("response") or []}
    normalized: dict[str, Any]
    if endpoint == "standings":
        normalized = {"groups": _api_football_standings(raw_payload)}
    elif endpoint == "fixtures":
        normalized = {"fixtures": _api_football_fixtures(raw_payload)}
    elif endpoint == "rounds":
        normalized = {"rounds": data.get("response") or []}
    elif endpoint in {"topscorers", "topassists"}:
        normalized = {"players": _api_football_leaders(raw_payload)}
    elif endpoint == "teams":
        normalized = {"teams": _api_football_teams(raw_payload)}
    else:
        normalized = {}
    return _finalize(endpoint, "api_football", normalized)


def _api_football_standings(payload: dict[str, Any]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for league_block in payload.get("response") or []:
        league = league_block.get("league") or {}
        for group_rows in league.get("standings") or []:
            rows = []
            group_name = None
            for row in group_rows or []:
                team = row.get("team") or {}
                all_stats = row.get("all") or {}
                goals = all_stats.get("goals") or {}
                group_name = group_name or row.get("group") or "Group"
                rows.append(
                    {
                        "rank": row.get("rank"),
                        "team_id": team.get("id"),
                        "team_name": team.get("name") or "-",
                        "team_logo": team.get("logo"),
                        "played": all_stats.get("played") or 0,
                        "won": all_stats.get("win") or 0,
                        "drawn": all_stats.get("draw") or 0,
                        "lost": all_stats.get("lose") or 0,
                        "goals_for": goals.get("for") or 0,
                        "goals_against": goals.get("against") or 0,
                        "goal_difference": row.get("goalsDiff") or 0,
                        "points": row.get("points") or 0,
                    }
                )
            if rows:
                groups.append({"group": group_name or "Group", "rows": rows})
    return groups


def _api_football_fixtures(payload: dict[str, Any]) -> list[dict[str, Any]]:
    fixtures: list[dict[str, Any]] = []
    for item in payload.get("response") or []:
        fixture = item.get("fixture") or {}
        league = item.get("league") or {}
        teams = item.get("teams") or {}
        goals = item.get("goals") or {}
        venue = fixture.get("venue") or {}
        status = fixture.get("status") or {}
        home = teams.get("home") or {}
        away = teams.get("away") or {}
        fixtures.append(
            {
                "id": fixture.get("id"),
                "date": fixture.get("date"),
                "round": league.get("round"),
                "status": status.get("long"),
                "status_short": status.get("short"),
                "venue": venue.get("name"),
                "home_team": home.get("name"),
                "home_logo": home.get("logo"),
                "away_team": away.get("name"),
                "away_logo": away.get("logo"),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
            }
        )
    return fixtures


def _api_football_leaders(payload: dict[str, Any]) -> list[dict[str, Any]]:
    leaders: list[dict[str, Any]] = []
    for item in payload.get("response") or []:
        player = item.get("player") or {}
        stats = (item.get("statistics") or [{}])[0] or {}
        team = stats.get("team") or {}
        games = stats.get("games") or {}
        goals = stats.get("goals") or {}
        leaders.append(
            {
                "player_id": player.get("id"),
                "name": player.get("name") or "-",
                "photo_url": player.get("photo"),
                "team_name": team.get("name"),
                "team_logo": team.get("logo"),
                "goals": goals.get("total") or 0,
                "assists": goals.get("assists") or 0,
                "appearances": games.get("appearences") or games.get("appearances"),
            }
        )
    return leaders


def _api_football_teams(payload: dict[str, Any]) -> list[dict[str, Any]]:
    teams: list[dict[str, Any]] = []
    for item in payload.get("response") or []:
        team = item.get("team") or {}
        teams.append(
            {
                "id": team.get("id"),
                "name": team.get("name") or "-",
                "code": team.get("code"),
                "country": team.get("country"),
                "logo_url": team.get("logo"),
            }
        )
    return teams


def _rounds_from_fixtures(fixtures: list[dict[str, Any]]) -> list[str]:
    seen = []
    for fixture in fixtures:
        name = fixture.get("round")
        if name and name not in seen:
            seen.append(name)
    return seen


def _clean_stage(value: str | None) -> str:
    if not value:
        return "-"
    return value.replace("_", " ").title()


def _clean_status(value: str | None) -> str | None:
    labels = {
        "SCHEDULED": "Oynanmadi",
        "TIMED": "Oynanmadi",
        "IN_PLAY": "Canli",
        "PAUSED": "Canli",
        "FINISHED": "Bitti",
        "POSTPONED": "Ertelendi",
    }
    return labels.get(value or "", value)


def meta(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": payload.get("source", SOURCE),
        "league_id": payload.get("league_id", WORLD_CUP_LEAGUE_ID),
        "season": payload.get("season", WORLD_CUP_SEASON),
        "cached": bool(payload.get("cached")),
        "fetched_at": payload.get("fetched_at"),
        "api_errors": payload.get("api_errors"),
        "message": payload.get("message"),
    }


def standings_from(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if "groups" in payload:
        return payload.get("groups") or []
    return _api_football_standings(payload)


def fixtures_from(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if "fixtures" in payload:
        return payload.get("fixtures") or []
    return _api_football_fixtures(payload)


def bracket_from(fixtures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    order = [
        ("Son 16", ("last 16", "round of 16", "8th finals")),
        ("Ceyrek Final", ("quarter",)),
        ("Yari Final", ("semi",)),
        ("Final", ("final",)),
    ]
    result: list[dict[str, Any]] = []
    for label, needles in order:
        rows = [
            fixture
            for fixture in fixtures
            if any(needle in (fixture.get("round") or "").lower() for needle in needles)
        ]
        if rows:
            result.append({"name": label, "fixtures": rows})
    return result


def leaders_from(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if "players" in payload:
        return payload.get("players") or []
    return _api_football_leaders(payload)


def teams_from(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if "teams" in payload:
        return payload.get("teams") or []
    return _api_football_teams(payload)


def read_winners() -> list[dict[str, Any]]:
    data = _read_json(_HISTORY_PATH)
    if not data:
        return []
    winners = data.get("winners") if isinstance(data, dict) else data
    if not isinstance(winners, list):
        return []
    return winners
