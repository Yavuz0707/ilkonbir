import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_session
from ..models import Player, PlayerSeasonStat, Transfer, Trophy
from ..schemas import MarketValuePointOut, PlayerDetailOut, PlayerWithClub, TrophyOut
from ..services.transfermarkt import _parse_value

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/search", response_model=list[PlayerWithClub])
async def search_players(
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(None, min_length=2, description="Oyuncu adi"),
    position: str | None = Query(None, description="GK/DF/MF/FW"),
    club_id: int | None = None,
    exclude_club_id: int | None = Query(None, description="Bu kulubun oyunculari haric"),
    limit: int = Query(20, le=50),
):
    stmt = (
        select(Player)
        .options(selectinload(Player.club))
        .order_by(Player.market_value.desc().nulls_last())
        .limit(limit)
    )
    if q:
        stmt = stmt.where(Player.name.ilike(f"%{q}%"))
    if position:
        stmt = stmt.where(Player.position == position.upper())
    if club_id:
        stmt = stmt.where(Player.club_id == club_id)
    if exclude_club_id:
        stmt = stmt.where(Player.club_id != exclude_club_id)
    return (await session.execute(stmt)).scalars().all()


@router.get("/{player_id}/trophies", response_model=list[TrophyOut])
async def player_trophies(player_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(Trophy)
        .where(Trophy.holder_type == "player", Trophy.holder_id == player_id)
        .order_by(Trophy.season.desc().nulls_last(), Trophy.competition_name)
    )
    return (await session.execute(stmt)).scalars().all()


def _tm_history_points(data: dict) -> list[MarketValuePointOut]:
    rows = data.get("marketValueHistory") or data.get("market_value_history") or []
    points: list[MarketValuePointOut] = []
    for item in rows:
        value = item.get("marketValue") if isinstance(item, dict) else None
        if value is None and isinstance(item, dict):
            value = item.get("market_value")
        date = item.get("date") if isinstance(item, dict) else None
        if not date:
            continue
        club_name = item.get("clubName") or item.get("club_name")
        points.append(MarketValuePointOut(date=str(date), market_value=_parse_value(value), club_name=club_name))
    return points


async def _fetch_market_value_history(player: Player) -> list[MarketValuePointOut]:
    if player.transfermarkt_id is None:
        return []
    settings = get_settings()
    try:
        async with httpx.AsyncClient(base_url=settings.transfermarkt_api_url, timeout=20) as client:
            resp = await client.get(f"/players/{player.transfermarkt_id}/market_value")
            if resp.status_code != 200:
                return []
            return _tm_history_points(resp.json())
    except httpx.HTTPError:
        return []


@router.get("/{player_id}", response_model=PlayerDetailOut)
async def player_detail(player_id: int, session: AsyncSession = Depends(get_session)):
    player = (
        await session.execute(
            select(Player).options(selectinload(Player.club)).where(Player.id == player_id)
        )
    ).scalar_one_or_none()
    if player is None:
        raise HTTPException(404, "Oyuncu bulunamadi")

    trophies = (
        await session.execute(
            select(Trophy)
            .where(Trophy.holder_type == "player", Trophy.holder_id == player.id)
            .order_by(Trophy.season.desc().nulls_last(), Trophy.competition_name)
        )
    ).scalars().all()
    transfers = (
        await session.execute(
            select(Transfer)
            .where(Transfer.player_id == player.id)
            .order_by(Transfer.transfer_date.desc().nulls_last(), Transfer.id.desc())
            .limit(20)
        )
    ).scalars().all()
    totals = (
        await session.execute(
            select(
                func.coalesce(func.sum(PlayerSeasonStat.goals), 0),
                func.coalesce(func.sum(PlayerSeasonStat.assists), 0),
            ).where(PlayerSeasonStat.player_id == player.id)
        )
    ).one()

    out = PlayerDetailOut.model_validate(player)
    out.trophies = [TrophyOut.model_validate(trophy) for trophy in trophies]
    out.transfers = transfers
    out.total_goals = int(totals[0] or 0)
    out.total_assists = int(totals[1] or 0)
    out.market_value_history = await _fetch_market_value_history(player)
    return out
