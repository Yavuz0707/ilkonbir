import random
import unicodedata
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import Club, Player, PlayerSeasonStat, Transfer
from ..schemas import (
    ClubMini,
    GameCardOut,
    GameRoundOut,
    LogoQuizRoundOut,
    TransferRouteClubOut,
    TransferRouteOptionOut,
    TransferRouteRoundOut,
)

router = APIRouter(prefix="/games", tags=["games"])

_WINDOW = 15
_MAX_PAIR_ATTEMPTS = 50
_LOGO_QUIZ_OPTION_COUNT = 4
_TRANSFER_ROUTE_OPTION_COUNT = 4


@dataclass(frozen=True)
class _Candidate:
    id: int
    value: int


def _norm_name(name: str | None) -> str:
    if not name:
        return ""
    normalized = (
        unicodedata.normalize("NFKD", name.replace("ı", "i").replace("İ", "I"))
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .replace("&", " ")
        .replace(".", " ")
        .replace("-", " ")
        .strip()
    )
    return " ".join(normalized.split())
    replacements = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return (
        name.translate(replacements)
        .lower()
        .replace("&", " ")
        .replace(".", " ")
        .replace("-", " ")
        .strip()
    )


def _same_club_name(left: str | None, right: str | None) -> bool:
    left_norm = _norm_name(left)
    right_norm = _norm_name(right)
    if not left_norm or not right_norm:
        return False
    if left_norm == right_norm:
        return True
    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    return bool(left_tokens and right_tokens) and (
        left_tokens.issubset(right_tokens) or right_tokens.issubset(left_tokens)
    )


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


def _club_option(player: Player) -> TransferRouteOptionOut:
    return TransferRouteOptionOut(
        id=player.id,
        name=player.name,
        photo_url=player.photo_url,
        position=player.position,
        club_name=player.club.name if player.club else None,
        club_logo=player.club.logo_url if player.club else None,
    )


async def _transfer_route_for(
    session: AsyncSession,
    player: Player,
    club_logos: dict[str, str | None],
    tm_club_logos: dict[str, str | None],
) -> list[TransferRouteClubOut]:
    has_transfermarkt_history = (
        await session.execute(
            select(Transfer.id)
            .where(Transfer.player_id == player.id, Transfer.source == "transfermarkt")
            .limit(1)
        )
    ).scalar_one_or_none()
    source_filter = "transfermarkt" if has_transfermarkt_history is not None else "api_football"
    transfers = (
        await session.execute(
            select(Transfer)
            .where(Transfer.player_id == player.id, Transfer.source == source_filter)
            .order_by(Transfer.transfer_date.asc().nulls_last(), Transfer.id.asc())
        )
    ).scalars().all()

    route: list[TransferRouteClubOut] = []
    for transfer in transfers:
        date = transfer.transfer_date
        if transfer.from_club and not route:
            route.append(
                TransferRouteClubOut(
                    name=transfer.from_club,
                    logo_url=tm_club_logos.get(transfer.external_from_club_id or "")
                    or club_logos.get(_norm_name(transfer.from_club)),
                    end_date=date,
                )
            )
        elif route and date and route[-1].end_date is None:
            route[-1].end_date = date

        if not transfer.to_club:
            continue
        if route and _same_club_name(route[-1].name, transfer.to_club):
            route[-1].start_date = route[-1].start_date or date
            route[-1].end_date = None
            continue
        route.append(
            TransferRouteClubOut(
                name=transfer.to_club,
                logo_url=tm_club_logos.get(transfer.external_to_club_id or "")
                or club_logos.get(_norm_name(transfer.to_club)),
                start_date=date,
            )
        )

    current_name = player.club.name if player.club else None
    current_tm_id = str(player.club.transfermarkt_id) if player.club and player.club.transfermarkt_id else None
    last_to_tm_id = str(transfers[-1].external_to_club_id) if transfers and transfers[-1].external_to_club_id else None
    current_matches_last = bool(current_tm_id and last_to_tm_id and current_tm_id == last_to_tm_id)
    if current_name and route and (
        _same_club_name(route[-1].name, current_name) or current_matches_last
    ):
        route[-1].logo_url = route[-1].logo_url or (player.club.logo_url if player.club else None)
    if current_name and (
        not route
        or (
            not _same_club_name(route[-1].name, current_name)
            and not current_matches_last
        )
    ):
        if route and route[-1].end_date is None:
            route[-1].end_date = transfers[-1].transfer_date if transfers else None
        route.append(
            TransferRouteClubOut(
                name=current_name,
                logo_url=player.club.logo_url if player.club else club_logos.get(_norm_name(current_name)),
                start_date=transfers[-1].transfer_date if transfers else None,
            )
        )

    cleaned: list[TransferRouteClubOut] = []
    for item in route:
        if not item.name:
            continue
        if cleaned and _same_club_name(cleaned[-1].name, item.name):
            cleaned[-1].end_date = item.end_date
            cleaned[-1].logo_url = cleaned[-1].logo_url or item.logo_url
            continue
        cleaned.append(item)
    return cleaned


async def _transfer_route_options(
    session: AsyncSession, correct: Player
) -> list[TransferRouteOptionOut]:
    def base_stmt():
        return (
            select(Player)
            .options(selectinload(Player.club))
            .where(Player.id != correct.id)
            .order_by(func.random())
        )

    picked: list[Player] = []
    seen = {correct.id}

    queries = [
        base_stmt()
        .join(Club, Player.club_id == Club.id, isouter=True)
        .where(Player.position == correct.position, Club.league == (correct.club.league if correct.club else None))
        .limit(_TRANSFER_ROUTE_OPTION_COUNT - 1),
        base_stmt().where(Player.position == correct.position).limit(_TRANSFER_ROUTE_OPTION_COUNT - 1),
        base_stmt().limit(_TRANSFER_ROUTE_OPTION_COUNT - 1),
    ]
    for stmt in queries:
        for player in (await session.execute(stmt)).scalars().all():
            if player.id in seen:
                continue
            picked.append(player)
            seen.add(player.id)
            if len(picked) >= _TRANSFER_ROUTE_OPTION_COUNT - 1:
                break
        if len(picked) >= _TRANSFER_ROUTE_OPTION_COUNT - 1:
            break

    if len(picked) < _TRANSFER_ROUTE_OPTION_COUNT - 1:
        raise HTTPException(404, "Transfer rotasi icin yeterli oyuncu yok")

    options = [_club_option(correct), *[_club_option(player) for player in picked]]
    random.shuffle(options)
    return options


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

    # _pick_pair ilk eleman olarak "anchor"i dondurur: bir onceki turdan tasinan,
    # degeri kullaniciya gosterilen (known) oyuncu; ilk turda rastgele secilir.
    # Bilinen kartin surekli ayni tarafta cikmamasi icin sol/sag pozisyonu burada
    # rastgele karistirilir. Frontend known/hidden ayrimini pozisyondan degil,
    # `known_id`'den yapar.
    anchor_candidate, other_candidate = _pick_pair(candidates, anchor_id, exclude_player_id)
    if random.random() < 0.5:
        left_candidate, right_candidate = anchor_candidate, other_candidate
    else:
        left_candidate, right_candidate = other_candidate, anchor_candidate

    left = await _card_for(session, category, left_candidate)
    right = await _card_for(session, category, right_candidate)

    if left.value == right.value:
        raise HTTPException(404, "Bu kategori icin yeterli farkli veri yok")

    higher_id = left.id if left.value > right.value else right.id
    return GameRoundOut(
        left=left, right=right, higher_id=higher_id, known_id=anchor_candidate.id
    )


@router.get("/logo-quiz/next", response_model=LogoQuizRoundOut)
async def logo_quiz_next(
    session: AsyncSession = Depends(get_session),
    exclude_ids: str | None = Query(
        None, description="Bu oyunda daha once sorulmus kulup id'leri (virgulle ayrilmis)"
    ),
):
    stmt = select(Club).where(Club.logo_url.isnot(None), Club.logo_url != "")
    clubs = (await session.execute(stmt)).scalars().all()
    if len(clubs) < _LOGO_QUIZ_OPTION_COUNT:
        raise HTTPException(404, "Logo bulmacasi icin yeterli kulup yok")

    excluded: set[int] = set()
    if exclude_ids:
        for part in exclude_ids.split(","):
            part = part.strip()
            if part.isdigit():
                excluded.add(int(part))

    pool = [club for club in clubs if club.id not in excluded] or clubs
    correct = random.choice(pool)
    distractor_pool = [club for club in clubs if club.id != correct.id]
    distractors = random.sample(
        distractor_pool, k=min(_LOGO_QUIZ_OPTION_COUNT - 1, len(distractor_pool))
    )

    options = [correct, *distractors]
    random.shuffle(options)

    return LogoQuizRoundOut(
        correct_id=correct.id,
        options=[ClubMini.model_validate(club) for club in options],
    )


@router.get("/transfer-route/next", response_model=TransferRouteRoundOut)
async def transfer_route_next(session: AsyncSession = Depends(get_session)):
    player_ids = (
        await session.execute(
            select(Transfer.player_id)
            .where(Transfer.player_id.isnot(None), Transfer.source == "transfermarkt")
            .group_by(Transfer.player_id)
            .having(func.count(Transfer.id) >= 2)
            .order_by(func.random())
            .limit(300)
        )
    ).scalars().all()
    if not player_ids:
        player_ids = (
            await session.execute(
                select(Transfer.player_id)
                .where(Transfer.player_id.isnot(None))
                .group_by(Transfer.player_id)
                .having(func.count(Transfer.id) >= 1)
                .order_by(func.random())
                .limit(300)
            )
        ).scalars().all()
    if not player_ids:
        raise HTTPException(404, "Transfer rotasi icin yeterli transfer verisi yok")

    clubs = (await session.execute(select(Club))).scalars().all()
    club_logos = {_norm_name(club.name): club.logo_url for club in clubs}
    tm_club_logos = {
        str(club.transfermarkt_id): club.logo_url
        for club in clubs
        if club.transfermarkt_id is not None
    }

    for player_id in player_ids:
        player = (
            await session.execute(
                select(Player).options(selectinload(Player.club)).where(Player.id == player_id)
            )
        ).scalar_one_or_none()
        if player is None:
            continue
        route = await _transfer_route_for(session, player, club_logos, tm_club_logos)
        distinct_clubs = {_norm_name(item.name) for item in route}
        if len(distinct_clubs) < 3:
            continue
        options = await _transfer_route_options(session, player)
        return TransferRouteRoundOut(
            route=route,
            options=options,
            correct_id=player.id,
            correct_name=player.name,
        )

    raise HTTPException(404, "Transfer rotasi icin yeterli uzunlukta oyuncu gecmisi yok")
