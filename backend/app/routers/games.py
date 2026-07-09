import random
import re
import unicodedata
import base64
import hashlib
import hmac
import json
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..config import get_settings
from ..models import Club, Player, PlayerSeasonStat, Transfer
from ..schemas import (
    ClueGuessAnswerIn,
    ClueGuessAnswerOut,
    ClueGuessHintOut,
    ClueGuessRoundOut,
    ClubMini,
    GameCardOut,
    GameRoundOut,
    LogoQuizRoundOut,
    SilhouetteOptionOut,
    SilhouetteRoundOut,
    TournamentPlayerOut,
    TransferRouteClubOut,
    TransferRouteOptionOut,
    TransferRouteRoundOut,
)

router = APIRouter(prefix="/games", tags=["games"])

_WINDOW = 15
_MAX_PAIR_ATTEMPTS = 50
_LOGO_QUIZ_OPTION_COUNT = 4
_SILHOUETTE_OPTION_COUNT = 4
_CLUE_GUESS_CANDIDATE_LIMIT = 250
_CLUE_GUESS_POINTS = {1: 30, 2: 20, 3: 10}
_TRANSFER_ROUTE_OPTION_COUNT = 4
_TRANSFER_ROUTE_CANDIDATE_LIMIT = 800
_MIN_TRANSFER_ROUTE_CLUBS = 3
_UNDER_AGE_RE = re.compile(r"\b(?:u|under|sub)\s*(\d{1,2})\b")
_TR_SUB_AGE_RE = re.compile(r"\b(?:sub|sub-)?(\d{1,2})\s*yas(?:alti)?\b")
_YOUTH_MARKER_RE = re.compile(
    r"\b(?:y|you|yth|youth|academy|akademi|jgd|jugend|formation|fo|for|u\s*18|u\s*17|u\s*16|u\s*15|u\s*14|u\s*13)\b"
)


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


def _is_route_club_allowed(name: str | None) -> bool:
    normalized = _norm_name(name)
    if not normalized:
        return False

    if _YOUTH_MARKER_RE.search(normalized):
        return False

    for pattern in (_UNDER_AGE_RE, _TR_SUB_AGE_RE):
        for match in pattern.finditer(normalized):
            if int(match.group(1)) < 19:
                return False
    return True


def _has_senior_route_depth(transfers: list[Transfer], current_name: str | None = None) -> bool:
    names: list[str] = []
    for transfer in transfers:
        for name in (transfer.from_club, transfer.to_club):
            if not name or not _is_route_club_allowed(name):
                continue
            if names and _same_club_name(names[-1], name):
                continue
            names.append(name)
    if current_name and _is_route_club_allowed(current_name):
        names.append(current_name)
    distinct = {_norm_name(name) for name in names}
    return len(distinct) >= _MIN_TRANSFER_ROUTE_CLUBS


async def _transfer_route_candidate_ids(session: AsyncSession) -> list[int]:
    player_ids = (
        await session.execute(
            select(Transfer.player_id)
            .where(Transfer.player_id.isnot(None), Transfer.source == "transfermarkt")
            .group_by(Transfer.player_id)
            .having(func.count(Transfer.id) >= 2)
            .order_by(func.random())
            .limit(_TRANSFER_ROUTE_CANDIDATE_LIMIT)
        )
    ).scalars().all()
    if player_ids:
        return player_ids

    return (
        await session.execute(
            select(Transfer.player_id)
            .where(Transfer.player_id.isnot(None))
            .group_by(Transfer.player_id)
            .having(func.count(Transfer.id) >= 2)
            .order_by(func.random())
            .limit(_TRANSFER_ROUTE_CANDIDATE_LIMIT)
        )
    ).scalars().all()


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
    )


def _silhouette_option(player: Player) -> SilhouetteOptionOut:
    return SilhouetteOptionOut(
        id=player.id,
        name=player.name,
        club_name=player.club.name if player.club else None,
        club_logo=player.club.logo_url if player.club else None,
    )


def _token_secret() -> bytes:
    settings = get_settings()
    secret = settings.admin_token or settings.database_url or "ilkonbir-dev-secret"
    return secret.encode("utf-8")


def _sign_payload(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    signature = hmac.new(_token_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{encoded}.{encoded_signature}"


def _read_signed_payload(token: str) -> dict:
    try:
        encoded, encoded_signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(400, "Gecersiz tur tokeni") from exc

    expected = hmac.new(_token_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
    actual = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
    if not hmac.compare_digest(expected, actual):
        raise HTTPException(400, "Gecersiz tur tokeni")

    raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    return json.loads(raw.decode("utf-8"))


def _value_band(value: int | None) -> str | None:
    if not value or value <= 0:
        return None
    bands = [
        (1_000_000, "EUR 1M altı"),
        (5_000_000, "EUR 1M-5M arası"),
        (10_000_000, "EUR 5M-10M arası"),
        (20_000_000, "EUR 10M-20M arası"),
        (50_000_000, "EUR 20M-50M arası"),
        (100_000_000, "EUR 50M-100M arası"),
    ]
    for limit, label in bands:
        if value < limit:
            return label
    return "EUR 100M+"


def _stat_band(value: int) -> str:
    if value <= 0:
        return "Kayıtlı sezonlarda 0"
    if value < 5:
        return "Kayıtlı sezonlarda 1-4"
    if value < 10:
        return "Kayıtlı sezonlarda 5-9"
    if value < 20:
        return "Kayıtlı sezonlarda 10-19"
    if value < 40:
        return "Kayıtlı sezonlarda 20-39"
    return "Kayıtlı sezonlarda 40+"


def _position_label(player: Player) -> str:
    labels = {"GK": "Kaleci", "DF": "Defans", "MF": "Orta saha", "FW": "Forvet"}
    return player.detail_position or labels.get(player.position, player.position)


def _tournament_size(requested: int, available: int) -> int:
    capped = min(max(requested, 2), 32, available)
    size = 1
    while size * 2 <= capped:
        size *= 2
    return size


def _tournament_player(player: Player) -> TournamentPlayerOut:
    return TournamentPlayerOut(
        id=player.id,
        name=player.name,
        photo_url=player.photo_url,
        club_name=player.club.name if player.club else None,
        club_logo=player.club.logo_url if player.club else None,
        position=player.position,
        detail_position=player.detail_position,
        market_value=player.market_value,
    )


async def _clue_hints_for(session: AsyncSession, player: Player) -> list[ClueGuessHintOut]:
    non_club: list[ClueGuessHintOut] = []
    if player.age:
        non_club.append(
            ClueGuessHintOut(
                kind="age",
                label="Yaş",
                text=f"Yaklaşık {player.age} yaşında",
            )
        )
    if player.position:
        non_club.append(
            ClueGuessHintOut(kind="position", label="Mevki", text=_position_label(player))
        )
    if player.nationality:
        non_club.append(
            ClueGuessHintOut(kind="nationality", label="Uyruk", text=player.nationality)
        )
    band = _value_band(player.market_value)
    if band:
        non_club.append(ClueGuessHintOut(kind="market_value", label="Piyasa Değeri", text=band))

    totals = (
        await session.execute(
            select(
                func.coalesce(func.sum(PlayerSeasonStat.goals), 0),
                func.coalesce(func.sum(PlayerSeasonStat.assists), 0),
            ).where(PlayerSeasonStat.player_id == player.id)
        )
    ).one()
    goals, assists = int(totals[0] or 0), int(totals[1] or 0)
    if goals > 0:
        non_club.append(ClueGuessHintOut(kind="goals", label="Gol", text=_stat_band(goals)))
    if assists > 0:
        non_club.append(ClueGuessHintOut(kind="assists", label="Asist", text=_stat_band(assists)))

    random.shuffle(non_club)
    hints = non_club[:2]
    if player.club:
        hints.append(
            ClueGuessHintOut(kind="club", label="Kulüp", text=player.club.name)
        )
    return hints[:3]


async def _pick_clue_player(session: AsyncSession) -> tuple[Player, list[ClueGuessHintOut]]:
    players = (
        await session.execute(
            select(Player)
            .options(selectinload(Player.club))
            .where(Player.club_id.isnot(None))
            .order_by(func.random())
            .limit(_CLUE_GUESS_CANDIDATE_LIMIT)
        )
    ).scalars().all()

    for player in players:
        hints = await _clue_hints_for(session, player)
        non_club_count = sum(1 for hint in hints if hint.kind != "club")
        if len(hints) >= 2 and non_club_count >= 1:
            return player, hints
    raise HTTPException(404, "Ipucu oyunu icin yeterli oyuncu verisi yok")


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
    if not _has_senior_route_depth(transfers, player.club.name if player.club else None):
        return []

    route: list[TransferRouteClubOut] = []
    for transfer in transfers:
        date = transfer.transfer_date
        from_allowed = _is_route_club_allowed(transfer.from_club)
        to_allowed = _is_route_club_allowed(transfer.to_club)

        if transfer.from_club and from_allowed and not route:
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

        if not transfer.to_club or not to_allowed:
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
        if not item.name or not _is_route_club_allowed(item.name):
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
    picked = (
        await session.execute(
            select(Player)
            .where(Player.id != correct.id)
            .order_by(func.random())
            .limit(_TRANSFER_ROUTE_OPTION_COUNT - 1)
        )
    ).scalars().all()

    if len(picked) < _TRANSFER_ROUTE_OPTION_COUNT - 1:
        raise HTTPException(404, "Transfer rotasi icin yeterli oyuncu yok")

    options = [_club_option(correct), *[_club_option(player) for player in picked]]
    random.shuffle(options)
    return options


@router.get("/tournament/superlig-clubs", response_model=list[ClubMini])
async def tournament_superlig_clubs(
    session: AsyncSession = Depends(get_session),
    size: int = Query(16, ge=2, le=32),
):
    stmt = (
        select(Club)
        .where(
            or_(
                Club.league.in_(["Super Lig", "Süper Lig"]),
                func.lower(Club.league).like("%super%lig%"),
                func.lower(Club.country).in_(["turkey", "turkiye", "türkiye"]),
            )
        )
        .order_by(func.random())
        .limit(32)
    )
    clubs = (await session.execute(stmt)).scalars().all()
    final_size = _tournament_size(size, len(clubs))
    if final_size < 2:
        raise HTTPException(404, "Turnuva icin yeterli Super Lig kulubu yok")
    return [ClubMini.model_validate(club) for club in clubs[:final_size]]


@router.get("/tournament/players", response_model=list[TournamentPlayerOut])
async def tournament_players(
    session: AsyncSession = Depends(get_session),
    size: int = Query(16, ge=2, le=32),
):
    stmt = (
        select(Player)
        .options(selectinload(Player.club))
        .where(Player.market_value.isnot(None), Player.market_value > 0)
        .order_by(Player.market_value.desc(), Player.id)
        .limit(32)
    )
    players = (await session.execute(stmt)).scalars().all()
    final_size = _tournament_size(size, len(players))
    if final_size < 2:
        raise HTTPException(404, "Turnuva icin yeterli oyuncu verisi yok")
    picked = players[:final_size]
    random.shuffle(picked)
    return [_tournament_player(player) for player in picked]


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


@router.get("/silhouette/next", response_model=SilhouetteRoundOut)
async def silhouette_next(
    session: AsyncSession = Depends(get_session),
    exclude_ids: str | None = Query(
        None, description="Bu oyunda daha once sorulmus oyuncu id'leri (virgulle ayrilmis)"
    ),
):
    stmt = (
        select(Player)
        .options(selectinload(Player.club))
        .where(Player.photo_url.isnot(None), Player.photo_url != "")
    )
    players = (await session.execute(stmt)).scalars().all()
    if len(players) < _SILHOUETTE_OPTION_COUNT:
        raise HTTPException(404, "Siluet oyunu icin yeterli fotograflı oyuncu yok")

    excluded: set[int] = set()
    if exclude_ids:
        for part in exclude_ids.split(","):
            part = part.strip()
            if part.isdigit():
                excluded.add(int(part))

    pool = [player for player in players if player.id not in excluded] or players
    correct = random.choice(pool)
    distractor_pool = [player for player in players if player.id != correct.id]
    distractors = random.sample(
        distractor_pool,
        k=min(_SILHOUETTE_OPTION_COUNT - 1, len(distractor_pool)),
    )

    options = [correct, *distractors]
    random.shuffle(options)

    return SilhouetteRoundOut(
        correct_id=correct.id,
        photo_url=correct.photo_url or "",
        options=[_silhouette_option(player) for player in options],
    )


@router.get("/clue-guess/next", response_model=ClueGuessRoundOut)
async def clue_guess_next(session: AsyncSession = Depends(get_session)):
    player, hints = await _pick_clue_player(session)
    return ClueGuessRoundOut(
        answer_token=_sign_payload({"player_id": player.id}),
        hints=hints,
    )


@router.post("/clue-guess/answer", response_model=ClueGuessAnswerOut)
async def clue_guess_answer(
    payload: ClueGuessAnswerIn,
    session: AsyncSession = Depends(get_session),
):
    data = _read_signed_payload(payload.answer_token)
    player_id = data.get("player_id")
    if not isinstance(player_id, int):
        raise HTTPException(400, "Gecersiz tur tokeni")

    player = (
        await session.execute(
            select(Player).options(selectinload(Player.club)).where(Player.id == player_id)
        )
    ).scalar_one_or_none()
    if player is None:
        raise HTTPException(404, "Oyuncu bulunamadi")

    correct = _norm_name(payload.guess) == _norm_name(player.name)
    hints_used = max(1, min(3, int(payload.revealed_hint_count or 1)))
    points = _CLUE_GUESS_POINTS.get(hints_used, 0) if correct else 0
    return ClueGuessAnswerOut(
        correct=correct,
        points=points,
        correct_name=player.name,
        photo_url=player.photo_url,
        club_name=player.club.name if player.club else None,
        club_logo=player.club.logo_url if player.club else None,
    )


@router.get("/transfer-route/next", response_model=TransferRouteRoundOut)
async def transfer_route_next(session: AsyncSession = Depends(get_session)):
    player_ids = await _transfer_route_candidate_ids(session)
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
        if len(distinct_clubs) < _MIN_TRANSFER_ROUTE_CLUBS:
            continue
        options = await _transfer_route_options(session, player)
        return TransferRouteRoundOut(
            route=route,
            options=options,
            correct_id=player.id,
            correct_name=player.name,
        )

    raise HTTPException(404, "Transfer rotasi icin yeterli uzunlukta oyuncu gecmisi yok")
