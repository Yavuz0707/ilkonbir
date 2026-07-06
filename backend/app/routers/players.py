from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import Player
from ..schemas import PlayerWithClub

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
