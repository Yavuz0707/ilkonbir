"""Gunluk veri senkronizasyonu (APScheduler).

ENABLE_SCHEDULER=true ise uygulama acilisinda kurulur; kadro sync'i ve piyasa
degeri sync'i gece saatlerinde ayri ayri calisir.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import get_settings
from .database import async_session_maker
from .services.api_football import sync_clubs_and_players
from .services.transfermarkt import sync_market_values

logger = logging.getLogger(__name__)


async def _run_clubs_sync() -> None:
    async with async_session_maker() as session:
        result = await sync_clubs_and_players(session)
        logger.info("Kadro senkronizasyonu: %s", result)


async def _run_market_value_sync() -> None:
    async with async_session_maker() as session:
        result = await sync_market_values(session)
        logger.info("Piyasa degeri senkronizasyonu: %s", result)


def create_scheduler() -> AsyncIOScheduler | None:
    settings = get_settings()
    if not settings.enable_scheduler:
        return None
    scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")
    scheduler.add_job(
        _run_clubs_sync,
        CronTrigger(hour=settings.sync_clubs_cron_hour, minute=0),
        id="sync_clubs",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _run_market_value_sync,
        CronTrigger(hour=settings.sync_market_values_cron_hour, minute=30),
        id="sync_market_values",
        max_instances=1,
        coalesce=True,
    )
    return scheduler
