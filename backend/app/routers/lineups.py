from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..formations_data import DEFAULT_FORMATION
from ..models import Club, Formation, Lineup, LineupSlot, Player
from ..schemas import FormationPatch, LineupCreate, LineupOut, LineupSummary, SlotPatch
from ..services.lineup_service import build_default_assignment, remap_assignment

router = APIRouter(prefix="/lineups", tags=["lineups"])

_LINEUP_OPTIONS = (
    selectinload(Lineup.club),
    selectinload(Lineup.formation),
    selectinload(Lineup.slots).selectinload(LineupSlot.player).selectinload(Player.club),
)


async def _load_lineup(lineup_id: int, session: AsyncSession) -> Lineup:
    stmt = select(Lineup).options(*_LINEUP_OPTIONS).where(Lineup.id == lineup_id)
    lineup = (await session.execute(stmt)).scalar_one_or_none()
    if lineup is None:
        raise HTTPException(404, "Lineup bulunamadi")
    _sort_slots(lineup)
    return lineup


def _sort_slots(lineup: Lineup) -> None:
    order = {s["key"]: i for i, s in enumerate(lineup.formation.position_slots)}
    lineup.slots.sort(key=lambda s: order.get(s.position_key, 99))


@router.post("", response_model=LineupOut, status_code=201)
async def create_lineup(payload: LineupCreate, session: AsyncSession = Depends(get_session)):
    """Kulubun gercek kadrosundan otomatik ilk onbirle yeni bir lineup olusturur."""
    club_stmt = select(Club).options(selectinload(Club.players)).where(Club.id == payload.club_id)
    club = (await session.execute(club_stmt)).scalar_one_or_none()
    if club is None:
        raise HTTPException(404, "Kulup bulunamadi")

    if payload.formation_id is not None:
        formation = await session.get(Formation, payload.formation_id)
    else:
        formation = (
            await session.execute(select(Formation).where(Formation.name == DEFAULT_FORMATION))
        ).scalar_one_or_none()
    if formation is None:
        raise HTTPException(404, "Formasyon bulunamadi")

    lineup = Lineup(club_id=club.id, formation_id=formation.id)
    session.add(lineup)
    await session.flush()

    assignment = build_default_assignment(club.players, formation)
    for key, player_id in assignment.items():
        session.add(LineupSlot(lineup_id=lineup.id, position_key=key, player_id=player_id))
    await session.commit()
    return await _load_lineup(lineup.id, session)


@router.get("/{lineup_id}", response_model=LineupOut)
async def get_lineup(lineup_id: int, session: AsyncSession = Depends(get_session)):
    return await _load_lineup(lineup_id, session)


@router.patch("/{lineup_id}/formation", response_model=LineupOut)
async def change_formation(
    lineup_id: int, payload: FormationPatch, session: AsyncSession = Depends(get_session)
):
    """Formasyonu degistirir; mevcut oyuncular rol uyumu korunarak yeni slotlara tasinir."""
    lineup = await _load_lineup(lineup_id, session)
    new_formation = await session.get(Formation, payload.formation_id)
    if new_formation is None:
        raise HTTPException(404, "Formasyon bulunamadi")
    if new_formation.id == lineup.formation_id:
        return lineup

    current = {slot.position_key: slot.player for slot in lineup.slots}
    assignment = remap_assignment(current, lineup.formation, new_formation)

    lineup.formation_id = new_formation.id
    lineup.slots.clear()  # delete-orphan cascade eski slotlari siler
    await session.flush()
    for key, player_id in assignment.items():
        session.add(LineupSlot(lineup_id=lineup.id, position_key=key, player_id=player_id))
    await session.commit()
    session.expire_all()
    return await _load_lineup(lineup_id, session)


@router.patch("/{lineup_id}/slots/{slot_key}", response_model=LineupOut)
async def change_slot_player(
    lineup_id: int,
    slot_key: str,
    payload: SlotPatch,
    session: AsyncSession = Depends(get_session),
):
    """Slottaki oyuncuyu degistirir.

    Secilen oyuncu zaten dizilisin baska bir slotundaysa iki slot takas edilir
    (ayni oyuncu iki kez sahada olamaz).
    """
    lineup = await _load_lineup(lineup_id, session)
    target = next((s for s in lineup.slots if s.position_key == slot_key), None)
    if target is None:
        raise HTTPException(404, f"Slot bulunamadi: {slot_key}")

    player = await session.get(Player, payload.player_id)
    if player is None:
        raise HTTPException(404, "Oyuncu bulunamadi")

    occupied = next(
        (s for s in lineup.slots if s.player_id == player.id and s.position_key != slot_key), None
    )
    if occupied is not None:
        occupied.player_id = target.player_id
    target.player_id = player.id
    await session.commit()
    session.expire_all()
    return await _load_lineup(lineup_id, session)


@router.get("/{lineup_id}/summary", response_model=LineupSummary)
async def lineup_summary(lineup_id: int, session: AsyncSession = Depends(get_session)):
    lineup = (
        await session.execute(
            select(Lineup).options(selectinload(Lineup.formation)).where(Lineup.id == lineup_id)
        )
    ).scalar_one_or_none()
    if lineup is None:
        raise HTTPException(404, "Lineup bulunamadi")

    total, count = (
        await session.execute(
            select(
                func.coalesce(func.sum(Player.market_value), 0),
                func.count(LineupSlot.id),
            )
            .select_from(LineupSlot)
            .join(Player, LineupSlot.player_id == Player.id)
            .where(LineupSlot.lineup_id == lineup_id)
        )
    ).one()

    return LineupSummary(
        lineup_id=lineup_id,
        total_market_value=int(total),
        player_count=int(count),
        formation=lineup.formation.name,
    )
