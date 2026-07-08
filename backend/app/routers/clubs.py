import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_session
from ..formations_data import DEFAULT_FORMATION
from ..models import Club, Coach, Formation, Transfer, Trophy
from ..schemas import (
    ClubDetail,
    ClubOut,
    ClubStatsOut,
    FormationOut,
    LineupSlotOut,
    MarketValuePointOut,
    PlayerOut,
    TrophyOut,
)
from ..services.lineup_service import build_default_assignment
from ..services.transfermarkt import _parse_value

router = APIRouter(prefix="/clubs", tags=["clubs"])


def _history_points(data: dict) -> list[MarketValuePointOut]:
    rows = data.get("marketValueHistory") or data.get("market_value_history") or data.get("history") or []
    points: list[MarketValuePointOut] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        value = item.get("marketValue") or item.get("market_value") or item.get("value")
        date = item.get("date") or item.get("season")
        if value is None or not date:
            continue
        points.append(
            MarketValuePointOut(
                date=str(date),
                market_value=_parse_value(value),
                club_name=item.get("clubName") or item.get("club_name"),
            )
        )
    return points


async def _fetch_club_market_history(club: Club) -> list[MarketValuePointOut]:
    if club.transfermarkt_id is None:
        return []
    settings = get_settings()
    paths = (
        f"/clubs/{club.transfermarkt_id}/market_value",
        f"/clubs/{club.transfermarkt_id}/market-value-history",
    )
    try:
        async with httpx.AsyncClient(base_url=settings.transfermarkt_api_url, timeout=12) as client:
            for path in paths:
                resp = await client.get(path)
                if resp.status_code == 200:
                    points = _history_points(resp.json())
                    if points:
                        return points
    except httpx.HTTPError:
        return []
    return []


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


@router.get("/coaches/{coach_id}/trophies", response_model=list[TrophyOut])
async def coach_trophies(coach_id: int, session: AsyncSession = Depends(get_session)):
    coach = await session.get(Coach, coach_id)
    if coach is None:
        raise HTTPException(404, "Teknik direktor bulunamadi")
    stmt = (
        select(Trophy)
        .where(Trophy.holder_type == "coach", Trophy.holder_id == coach_id)
        .order_by(Trophy.season.desc().nulls_last(), Trophy.competition_name)
    )
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


@router.get("/{club_id}/stats", response_model=ClubStatsOut)
async def club_stats(club_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(Club)
        .options(selectinload(Club.coach), selectinload(Club.players))
        .where(Club.id == club_id)
    )
    club = (await session.execute(stmt)).scalar_one_or_none()
    if club is None:
        raise HTTPException(404, "Kulup bulunamadi")

    club.players.sort(key=lambda p: (p.market_value or 0), reverse=True)
    total_value = sum(p.market_value or 0 for p in club.players)
    player_count = len(club.players)
    transfers = (
        await session.execute(
            select(Transfer)
            .where(
                Transfer.player_id.in_([p.id for p in club.players] or [-1]),
            )
            .order_by(Transfer.transfer_date.desc().nulls_last(), Transfer.id.desc())
            .limit(30)
        )
    ).scalars().all()

    return ClubStatsOut(
        club=ClubDetail.model_validate(club),
        total_market_value=total_value,
        average_market_value=int(total_value / player_count) if player_count else 0,
        player_count=player_count,
        top_players=[PlayerOut.model_validate(p) for p in club.players[:8]],
        transfers=transfers,
        market_value_history=await _fetch_club_market_history(club),
    )


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
