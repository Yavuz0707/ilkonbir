from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..formations_data import DEFAULT_FORMATION
from ..models import Club, Formation
from ..schemas import ClubDetail, ClubOut, FormationOut, LineupSlotOut, PlayerOut
from ..services.lineup_service import build_default_assignment

router = APIRouter(prefix="/clubs", tags=["clubs"])


@router.get("", response_model=list[ClubOut])
async def list_clubs(
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(None, description="Kulup adi aramasi"),
    league: str | None = Query(None, description="Lig adi filtresi"),
    country: str | None = None,
):
    stmt = select(Club).options(selectinload(Club.coach)).order_by(Club.league, Club.name)
    if q:
        stmt = stmt.where(Club.name.ilike(f"%{q}%"))
    if league:
        stmt = stmt.where(Club.league == league)
    if country:
        stmt = stmt.where(Club.country == country)
    return (await session.execute(stmt)).scalars().all()


@router.get("/{club_id}", response_model=ClubDetail)
async def get_club(club_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(Club)
        .options(selectinload(Club.coach), selectinload(Club.players))
        .where(Club.id == club_id)
    )
    club = (await session.execute(stmt)).scalar_one_or_none()
    if club is None:
        raise HTTPException(404, "Kulup bulunamadi")
    club.players.sort(key=lambda p: (p.market_value or 0), reverse=True)
    return club


@router.get("/{club_id}/default-lineup")
async def get_default_lineup(club_id: int, session: AsyncSession = Depends(get_session)):
    """Kulubun kadrosundan varsayilan formasyonla otomatik kurulmus ilk onbir.

    Lineup kaydi OLUSTURMAZ; onizleme niteligindedir. Kalici duzenleme icin
    POST /lineups kullanilir.
    """
    stmt = select(Club).options(selectinload(Club.players)).where(Club.id == club_id)
    club = (await session.execute(stmt)).scalar_one_or_none()
    if club is None:
        raise HTTPException(404, "Kulup bulunamadi")

    formation = (
        await session.execute(select(Formation).where(Formation.name == DEFAULT_FORMATION))
    ).scalar_one_or_none()
    if formation is None:
        raise HTTPException(500, "Varsayilan formasyon tanimli degil (seed calistirildi mi?)")

    assignment = build_default_assignment(club.players, formation)
    players_by_id = {p.id: p for p in club.players}
    slots = [
        LineupSlotOut(
            position_key=key,
            player=PlayerOut.model_validate(players_by_id[pid]) if pid else None,
        )
        for key, pid in assignment.items()
    ]
    return {
        "club_id": club.id,
        "formation": FormationOut.model_validate(formation),
        "slots": slots,
    }
