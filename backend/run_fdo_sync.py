"""football-data.org gol krallığı senkronizasyonu — bağımsız (uvicorn'dan izole).

    python run_fdo_sync.py
"""

import asyncio

from app.database import async_session_maker
from app.services.football_data_org import sync_football_data_org_scorers


async def main() -> None:
    async with async_session_maker() as session:
        print(await sync_football_data_org_scorers(session))


if __name__ == "__main__":
    asyncio.run(main())
