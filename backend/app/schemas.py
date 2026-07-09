from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CoachOut(ORMModel):
    id: int
    name: str
    photo_url: str | None = None
    nationality: str | None = None


class ClubMini(ORMModel):
    id: int
    name: str
    short_name: str | None = None
    logo_url: str | None = None
    league: str | None = None
    country: str | None = None


class PlayerOut(ORMModel):
    id: int
    name: str
    photo_url: str | None = None
    position: str
    detail_position: str | None = None
    nationality: str | None = None
    age: int | None = None
    jersey_number: int | None = None
    market_value: int | None = None
    market_value_updated_at: datetime | None = None
    club_id: int | None = None


class PlayerWithClub(PlayerOut):
    club: ClubMini | None = None


class ClubOut(ClubMini):
    coach: CoachOut | None = None


class ClubDetail(ClubOut):
    players: list[PlayerOut] = []


class PositionSlot(BaseModel):
    key: str
    label: str
    role: str
    x: float
    y: float


class FormationOut(ORMModel):
    id: int
    name: str
    position_slots: list[PositionSlot]


class LineupSlotOut(ORMModel):
    position_key: str
    player: PlayerWithClub | None = None


class LineupOut(ORMModel):
    id: int
    club: ClubMini
    formation: FormationOut
    slots: list[LineupSlotOut]
    created_at: datetime
    updated_at: datetime


class LineupCreate(BaseModel):
    club_id: int
    formation_id: int | None = None  # bos ise varsayilan formasyon (4-3-3)


class FormationPatch(BaseModel):
    formation_id: int


class SlotPatch(BaseModel):
    player_id: int


class LineupSummary(BaseModel):
    lineup_id: int
    total_market_value: int
    player_count: int
    formation: str


class SyncRequest(BaseModel):
    clubs: bool = True
    market_values: bool = True
    top_stats: bool = False
    transfers: bool = False
    trophies: bool = False
    trophy_limit: int = 25
    football_data_org: bool = False
    football_data_org_clubs: bool = False


class SyncResult(BaseModel):
    detail: str


class TopStatOut(ORMModel):
    source: str = "api_football"
    external_player_id: int
    player_id: int | None = None
    name: str
    photo_url: str | None = None
    club_name: str | None = None
    club_logo: str | None = None
    league_id: int
    league_name: str | None = None
    season: int
    goals: int
    assists: int


class GameCardOut(BaseModel):
    """'Kim Daha İyi?' oyunu için tek bir oyuncu kartı.

    `id` kategoriye göre farklı bir tabloya işaret eder (market_value için
    Player.id, goals/assists için PlayerSeasonStat.id) — frontend bunu
    şeffafçe `exclude_id` olarak geri yollar, hangi tabloya ait olduğunu
    bilmesi gerekmez.
    """

    id: int
    name: str
    photo_url: str | None = None
    club_name: str | None = None
    club_logo: str | None = None
    value: int


class GameRoundOut(BaseModel):
    left: GameCardOut
    right: GameCardOut
    higher_id: int
    # Degeri gosterilecek (bilinen) oyuncunun id'si — pozisyondan bagimsizdir,
    # sol da sag da olabilir. Frontend hangi kartin "?" ile gizlenecegini buna
    # gore belirler.
    known_id: int


class LogoQuizRoundOut(BaseModel):
    correct_id: int
    options: list[ClubMini]


class SilhouetteOptionOut(BaseModel):
    id: int
    name: str
    club_name: str | None = None
    club_logo: str | None = None


class SilhouetteRoundOut(BaseModel):
    correct_id: int
    photo_url: str
    options: list[SilhouetteOptionOut]


class ClueGuessHintOut(BaseModel):
    kind: str
    label: str
    text: str


class ClueGuessRoundOut(BaseModel):
    answer_token: str
    hints: list[ClueGuessHintOut]


class ClueGuessAnswerIn(BaseModel):
    answer_token: str
    guess: str = ""
    revealed_hint_count: int = 1


class ClueGuessAnswerOut(BaseModel):
    correct: bool
    points: int
    correct_name: str
    photo_url: str | None = None
    club_name: str | None = None
    club_logo: str | None = None


class TransferRouteClubOut(BaseModel):
    name: str
    logo_url: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class TransferRouteOptionOut(BaseModel):
    id: int
    name: str
    photo_url: str | None = None


class TransferRouteRoundOut(BaseModel):
    route: list[TransferRouteClubOut]
    options: list[TransferRouteOptionOut]
    correct_id: int
    correct_name: str


class TournamentPlayerOut(BaseModel):
    id: int
    name: str
    photo_url: str | None = None
    club_name: str | None = None
    club_logo: str | None = None
    position: str | None = None
    detail_position: str | None = None
    market_value: int | None = None


class WorldCupMeta(BaseModel):
    source: str = "api_football"
    league_id: int = 1
    season: int = 2026
    cached: bool = False
    fetched_at: str | None = None
    api_errors: dict | list | str | None = None
    message: str | None = None


class WorldCupStandingRow(BaseModel):
    rank: int | None = None
    team_id: int | None = None
    team_name: str
    team_logo: str | None = None
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    points: int = 0


class WorldCupStandingGroup(BaseModel):
    group: str
    rows: list[WorldCupStandingRow]


class WorldCupStandingsOut(WorldCupMeta):
    groups: list[WorldCupStandingGroup] = []


class WorldCupFixtureOut(BaseModel):
    id: int | None = None
    date: str | None = None
    round: str | None = None
    status: str | None = None
    status_short: str | None = None
    venue: str | None = None
    home_team: str | None = None
    home_logo: str | None = None
    away_team: str | None = None
    away_logo: str | None = None
    home_goals: int | None = None
    away_goals: int | None = None


class WorldCupFixturesOut(WorldCupMeta):
    fixtures: list[WorldCupFixtureOut] = []


class WorldCupRoundsOut(WorldCupMeta):
    rounds: list[str] = []


class WorldCupBracketRound(BaseModel):
    name: str
    fixtures: list[WorldCupFixtureOut] = []


class WorldCupBracketOut(WorldCupMeta):
    rounds: list[WorldCupBracketRound] = []


class WorldCupLeaderOut(BaseModel):
    player_id: int | None = None
    name: str
    photo_url: str | None = None
    team_name: str | None = None
    team_logo: str | None = None
    goals: int = 0
    assists: int = 0
    appearances: int | None = None


class WorldCupLeadersOut(WorldCupMeta):
    players: list[WorldCupLeaderOut] = []


class WorldCupTeamOut(BaseModel):
    id: int | None = None
    name: str
    code: str | None = None
    country: str | None = None
    logo_url: str | None = None


class WorldCupTeamsOut(WorldCupMeta):
    teams: list[WorldCupTeamOut] = []


class WorldCupWinnerOut(BaseModel):
    year: int
    host_country: str
    champion: str
    runner_up: str
    third_place: str | None = None
    fourth_place: str | None = None
    final_score: str | None = None
    top_scorer: str | None = None
    top_scorer_goals: int | None = None


class TrophyOut(ORMModel):
    id: int
    holder_type: str
    holder_id: int
    competition_name: str
    season: str | None = None
    place: str | None = None
    club_name: str | None = None
    country: str | None = None


class ClubValueOut(BaseModel):
    club: ClubMini
    total_market_value: int
    player_count: int


class TransferOut(ORMModel):
    id: int
    source: str
    player_name: str
    from_club: str | None = None
    to_club: str | None = None
    transfer_date: str | None = None
    fee: str | None = None


class MarketValuePointOut(BaseModel):
    date: str
    market_value: int | None = None
    club_name: str | None = None


class PlayerDetailOut(PlayerWithClub):
    trophies: list[TrophyOut] = []
    transfers: list[TransferOut] = []
    total_goals: int = 0
    total_assists: int = 0
    market_value_history: list[MarketValuePointOut] = []


class ClubStatsOut(BaseModel):
    club: ClubDetail
    total_market_value: int
    average_market_value: int
    player_count: int
    top_players: list[PlayerOut]
    transfers: list[TransferOut]
    market_value_history: list[MarketValuePointOut] = []
