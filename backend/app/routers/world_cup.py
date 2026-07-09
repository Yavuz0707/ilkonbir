from fastapi import APIRouter

from ..schemas import (
    WorldCupBracketOut,
    WorldCupFixturesOut,
    WorldCupLeadersOut,
    WorldCupRoundsOut,
    WorldCupStandingsOut,
    WorldCupTeamsOut,
    WorldCupWinnerOut,
)
from ..services.world_cup import (
    bracket_from,
    fetch_world_cup,
    fixtures_from,
    leaders_from,
    meta,
    read_winners,
    standings_from,
    teams_from,
)

router = APIRouter(prefix="/world-cup", tags=["world-cup"])


@router.get("/2026/standings", response_model=WorldCupStandingsOut)
async def world_cup_standings():
    payload = await fetch_world_cup("standings")
    return {**meta(payload), "groups": standings_from(payload)}


@router.get("/2026/fixtures", response_model=WorldCupFixturesOut)
async def world_cup_fixtures():
    payload = await fetch_world_cup("fixtures")
    return {**meta(payload), "fixtures": fixtures_from(payload)}


@router.get("/2026/rounds", response_model=WorldCupRoundsOut)
async def world_cup_rounds():
    payload = await fetch_world_cup("rounds")
    return {**meta(payload), "rounds": payload.get("rounds") or payload.get("response") or []}


@router.get("/2026/bracket", response_model=WorldCupBracketOut)
async def world_cup_bracket():
    payload = await fetch_world_cup("fixtures")
    fixtures = fixtures_from(payload)
    message = payload.get("message")
    rounds = bracket_from(fixtures)
    if not rounds and not payload.get("api_errors"):
        message = "Eleme agaci turnuva ilerledikce burada olusacak."
    return {**meta({**payload, "message": message}), "rounds": rounds}


@router.get("/2026/top-scorers", response_model=WorldCupLeadersOut)
async def world_cup_top_scorers():
    payload = await fetch_world_cup("topscorers")
    return {**meta(payload), "players": leaders_from(payload)}


@router.get("/2026/top-assists", response_model=WorldCupLeadersOut)
async def world_cup_top_assists():
    payload = await fetch_world_cup("topassists")
    return {**meta(payload), "players": leaders_from(payload)}


@router.get("/2026/teams", response_model=WorldCupTeamsOut)
async def world_cup_teams():
    payload = await fetch_world_cup("teams")
    return {**meta(payload), "teams": teams_from(payload)}


@router.get("/history/winners", response_model=list[WorldCupWinnerOut])
async def world_cup_history_winners():
    return read_winners()
