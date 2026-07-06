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


class ClubValueOut(BaseModel):
    club: ClubMini
    total_market_value: int
    player_count: int
