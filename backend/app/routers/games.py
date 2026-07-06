import random
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import Player, PlayerSeasonStat
from ..schemas import GameCardOut, GameRoundOut

router = APIRouter(prefix="/games", tags=["games"])

_WINDOW = 15
_MAX_PAIR_ATTEMPTS = 50


@dataclass(frozen=True)
class _Candidate:
    id: int
    value: int


async def _ranked_candidates(session: AsyncSession, category: str) -> list[_Candidate]:
    if category == "market_value":
        stmt = (
            select(Player.id, Player.market_value)
            .where(Player.market_value.isnot(None), Player.market_value > 0)
            .order_by(Player.market_value.desc(), Player.id)
        )
        rows = (await session.execute(stmt)).all()
        return [_Candidate(id=player_id, value=int(value or 0)) for player_id, value in rows]

    if category not in {"goals", "assists"}:
        raise HTTPException(400, "Gecersiz kategori")

    metric = PlayerSeasonStat.goals if category == "goals" else PlayerSeasonStat.assists
    total = func.coalesce(func.sum(metric), 0).label("total")
    stmt = (
        select(PlayerSeasonStat.player_id, total)
        .where(PlayerSeasonStat.player_id.isnot(None))
        .group_by(PlayerSeasonStat.player_id)
        .having(total > 0)
        .order_by(total.desc(), PlayerSeasonStat.player_id)
    )
    rows = (await session.execute(stmt)).all()
    return [_Candidate(id=player_id, value=int(value or 0)) for player_id, value in rows]


def _pick_anchor(candidates: list[_Candidate], anchor_id: int | None) -> _Candidate:
    if anchor_id is not None:
        anchor = next((candidate for candidate in candidates if candidate.id == anchor_id), None)
        if anchor is not None:
            return anchor
    return random.choice(candidates)


def _nearby_candidates(
    candidates: list[_Candidate],
    anchor: _Candidate,
    exclude_id: int | None,
) -> list[_Candidate]:
    anchor_index = next((i for i, item in enumerate(candidates) if item.id == anchor.id), None)
    if anchor_index is None:
        return []

    lo = max(0, anchor_index - _WINDOW)
    hi = min(len(candidates), anchor_index + _WINDOW + 1)
    nearby = [
        item
        for item in candidates[lo:hi]
        if item.id not in {anchor.id, exclude_id} and item.value != anchor.value
    ]
    if nearby:
        return nearby
    return [
        item
        for item in candidates
        if item.id not in {anchor.id, exclude_id} and item.value != anchor.value
    ]


def _pick_pair(
    candidates: list[_Candidate],
    anchor_id: int | None,
    exclude_id: int | None,
) -> tuple[_Candidate, _Candidate]:
    if len({candidate.value for candidate in candidates}) < 2:
        raise HTTPException(404, "Bu kategori icin yeterli farkli veri yok")

    for _ in range(_MAX_PAIR_ATTEMPTS):
        left = _pick_anchor(candidates, anchor_id)
        right_options = _nearby_candidates(candidates, left, exclude_id)
        if not right_options:
            continue
        right = random.choice(right_options)
        if left.value != right.value:
            return left, right

    raise HTTPException(404, "Bu kategori icin yeterli farkli veri yok")


async def _card_for(
    session: AsyncSession,
    category: str,
    candidate: _Candidate,
) -> GameCardOut:
    player = (
        await session.execute(
            select(Player).options(selectinload(Player.club)).where(Player.id == candidate.id)
        )
    ).scalar_one_or_none()
    if player is None:
        raise HTTPException(404, "Oyuncu bulunamadi")

    if category == "market_value":
        value = player.market_value or 0
    else:
        value = candidate.value

    return GameCardOut(
        id=player.id,
        name=player.name,
        photo_url=player.photo_url,
        club_name=player.club.name if player.club else None,
        club_logo=player.club.logo_url if player.club else None,
        value=int(value),
    )


@router.get("/higher-lower/next", response_model=GameRoundOut)
async def next_round(
    session: AsyncSession = Depends(get_session),
    category: str = Query("market_value", pattern="^(market_value|goals|assists)$"),
    anchor_id: int | None = Query(None),
    exclude_player_id: int | None = Query(None),
):
    candidates = await _ranked_candidates(session, category)
    if len(candidates) < 2:
        raise HTTPException(404, "Bu kategori icin yeterli farkli veri yok")

    left_candidate, right_candidate = _pick_pair(candidates, anchor_id, exclude_player_id)
    left = await _card_for(session, category, left_candidate)
    right = await _card_for(session, category, right_candidate)

    if left.value == right.value:
        raise HTTPException(404, "Bu kategori icin yeterli farkli veri yok")

    higher_id = left.id if left.value > right.value else right.id
    return GameRoundOut(left=left, right=right, higher_id=higher_id)
