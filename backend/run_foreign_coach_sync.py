"""PL/La Liga/Bundesliga/Serie A/Ligue 1 kulüplerini API-Football team ID'sine
bağlar ve teknik direktörlerini senkronize eder. Bağımsız (uvicorn'dan izole).
Günlük kota kısıtı nedeniyle idempotent'tir — birden fazla gün art arda
çalıştırılıp kalan kulüpler tamamlanabilir.

    python run_foreign_coach_sync.py
"""

import asyncio

from app.database import async_session_maker
from app.services.api_football import link_and_sync_foreign_coaches


async def main() -> None:
    async with async_session_maker() as session:
        print(await link_and_sync_foreign_coaches(session))


if __name__ == "__main__":
    asyncio.run(main())
