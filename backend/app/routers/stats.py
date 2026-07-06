from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import Club, Player, PlayerSeasonStat
from ..schemas import ClubValueOut, PlayerWithClub, TopStatOut

router = APIRouter(prefix="/stats", tags=["stats"])


def _latest_per_league_subquery():
    return (
        select(PlayerSeasonStat.league_id, func.max(PlayerSeasonStat.season).label("max_season"))
        .group_by(PlayerSeasonStat.league_id)
        .subquery()
    )


async def _leaderboard(
    session: AsyncSession,
    order_col,
    tiebreak_col,
    league_id: int | None,
    season: int | None,
    limit: int,
):
    """Belirli lig secilirse o ligin (verilen ya da en guncel) sezonunu doner.

    Lig secilmemisse ("Genel"): her ligin KENDI en guncel sezonu birlestirilir.
    Boylece football-data.org (2025-26) ve API-Football (2024-25) gibi farkli
    sezon vintage'larina sahip kaynaklar tek bir sezon numarasiyla filtrelenip
    birbirini yanlislikla elemez.
    """
    if league_id is not None:
        if season is None:
            season = (
                await session.execute(
                    select(func.max(PlayerSeasonStat.season)).where(
                        PlayerSeasonStat.league_id == league_id
                    )
                )
            ).scalar_one_or_none()
        stmt = select(PlayerSeasonStat).where(PlayerSeasonStat.league_id == league_id)
        if season is not None:
            stmt = stmt.where(PlayerSeasonStat.season == season)
        stmt = stmt.order_by(order_col.desc(), tiebreak_col.desc()).limit(limit)
        return (await session.execute(stmt)).scalars().all()

    latest = _latest_per_league_subquery()
    stmt = (
        select(PlayerSeasonStat)
        .join(
            latest,
            (PlayerSeasonStat.league_id == latest.c.league_id)
            & (PlayerSeasonStat.season == latest.c.max_season),
        )
        .order_by(order_col.desc(), tiebreak_col.desc())
        .limit(limit)
    )
    return (await session.execute(stmt)).scalars().all()


@router.get("/competitions")
async def competitions(
    session: AsyncSession = Depends(get_session),
    metric: str | None = Query(None, pattern="^(goals|assists)$"),
):
    """Gol/asist krallığı selektörleri için DB'de mevcut ligleri döndürür.

    `metric` verilirse yalnızca o metrikte gerçek veri olan ligler listelenir
    (örn. football-data.org kaynaklı ligler asist verisi taşımadığı için
    metric=assists'te otomatik elenir).
    """
    rows = (
        await session.execute(
            select(
                PlayerSeasonStat.league_id,
                PlayerSeasonStat.league_name,
                PlayerSeasonStat.source,
                PlayerSeasonStat.season,
            ).distinct()
        )
    ).all()

    leagues: dict[int, dict] = {}
    for league_id, league_name, source, season in rows:
        entry = leagues.setdefault(
            league_id,
            {"league_id": league_id, "league_name": league_name, "source": source, "seasons": set()},
        )
        entry["seasons"].add(season)

    if metric:
        metric_col = PlayerSeasonStat.goals if metric == "goals" else PlayerSeasonStat.assists
        has_data = set(
            (
                await session.execute(
                    select(PlayerSeasonStat.league_id).where(metric_col > 0).distinct()
                )
            )
            .scalars()
            .all()
        )
        leagues = {k: v for k, v in leagues.items() if k in has_data}

    result = []
    for entry in leagues.values():
        seasons_sorted = sorted(entry["seasons"], reverse=True)
        result.append(
            {
                "league_id": entry["league_id"],
                "league_name": entry["league_name"],
                "source": entry["source"],
                "seasons": seasons_sorted,
                "latest_season": seasons_sorted[0] if seasons_sorted else None,
            }
        )
    result.sort(key=lambda r: (-(r["latest_season"] or 0), r["league_name"] or ""))
    return {"leagues": result}


@router.get("/top-scorers", response_model=list[TopStatOut])
async def top_scorers(
    session: AsyncSession = Depends(get_session),
    league_id: int | None = None,
    season: int | None = None,
    limit: int = Query(15, le=40),
):
    return await _leaderboard(
        session, PlayerSeasonStat.goals, PlayerSeasonStat.assists, league_id, season, limit
    )


@router.get("/top-assists", response_model=list[TopStatOut])
async def top_assists(
    session: AsyncSession = Depends(get_session),
    league_id: int | None = None,
    season: int | None = None,
    limit: int = Query(15, le=40),
):
    return await _leaderboard(
        session, PlayerSeasonStat.assists, PlayerSeasonStat.goals, league_id, season, limit
    )


@router.get("/most-valuable-clubs", response_model=list[ClubValueOut])
async def most_valuable_clubs(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, le=30),
):
    total = func.coalesce(func.sum(Player.market_value), 0).label("total")
    count = func.count(Player.id).label("cnt")
    stmt = (
        select(Club, total, count)
        .join(Player, Player.club_id == Club.id)
        .options(selectinload(Club.coach))
        .group_by(Club.id)
        .having(total > 0)
        .order_by(total.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [
        ClubValueOut(club=club, total_market_value=int(t), player_count=int(c))
        for club, t, c in rows
    ]


@router.get("/most-valuable-players", response_model=list[PlayerWithClub])
async def most_valuable_players(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, le=30),
):
    stmt = (
        select(Player)
        .options(selectinload(Player.club))
        .where(Player.market_value.isnot(None))
        .order_by(Player.market_value.desc())
        .limit(limit)
    )
    return (await session.execute(stmt)).scalars().all()
