r"""Transfermarkt profesyonel transfer gecmisi senkronizasyonu.

Kullanim:
    .\.venv\Scripts\python run_transfer_history_sync.py --limit 80
"""

import argparse
import asyncio

from app.database import async_session_maker
from app.services.transfermarkt import sync_transfer_histories


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=80)
    args = parser.parse_args()

    async with async_session_maker() as session:
        result = await sync_transfer_histories(session, limit=args.limit)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
