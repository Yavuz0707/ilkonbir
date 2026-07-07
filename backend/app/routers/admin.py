from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException

from ..config import get_settings
from ..database import async_session_maker
from ..schemas import SyncRequest, SyncResult
from ..services.api_football import (
    sync_clubs_and_players,
    sync_top_stats,
    sync_transfers,
    sync_trophies,
)
from ..services.football_data_org import sync_football_data_org_scorers, sync_foreign_clubs
from ..services.transfermarkt import sync_market_values

router = APIRouter(prefix="/admin", tags=["admin"])


def _check_token(x_admin_token: str | None = Header(None)) -> None:
    settings = get_settings()
    if settings.admin_token and x_admin_token != settings.admin_token:
        raise HTTPException(401, "Gecersiz admin token")


async def _run_sync(
    clubs: bool,
    market_values: bool,
    top_stats: bool,
    transfers: bool,
    trophies: bool,
    trophy_limit: int,
    football_data_org: bool,
    football_data_org_clubs: bool,
) -> None:
    async with async_session_maker() as session:
        if clubs:
            await sync_clubs_and_players(session)
        if football_data_org_clubs:
            await sync_foreign_clubs(session)
        if market_values:
            await sync_market_values(session)
        if top_stats:
            await sync_top_stats(session)
        if transfers:
            await sync_transfers(session)
        if trophies:
            await sync_trophies(session, limit=trophy_limit)
        if football_data_org:
            await sync_football_data_org_scorers(session)


@router.post("/sync", response_model=SyncResult, dependencies=[Depends(_check_token)])
async def trigger_sync(payload: SyncRequest, background: BackgroundTasks):
    """Kadro / piyasa değeri / gol-asist / transfer senkronizasyonunu arka planda başlatır."""
    background.add_task(
        _run_sync,
        payload.clubs,
        payload.market_values,
        payload.top_stats,
        payload.transfers,
        payload.trophies,
        payload.trophy_limit,
        payload.football_data_org,
        payload.football_data_org_clubs,
    )
    return SyncResult(detail="Senkronizasyon arka planda baslatildi.")
