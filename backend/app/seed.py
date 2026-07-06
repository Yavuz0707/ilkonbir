"""Veritabanini formasyon sablonlari ve demo kadro verisiyle doldurur.

Kullanim:
    python -m app.seed            # bos DB'ye seed atar (mevcut veri varsa dokunmaz)
    python -m app.seed --force    # tum tablolari silip yeniden olusturur
"""

import asyncio
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from .database import Base, async_session_maker, engine
from .formations_data import FORMATIONS
from .models import Club, Coach, Formation, Player
from .seed_data import CLUBS


async def seed(force: bool = False) -> None:
    async with engine.begin() as conn:
        if force:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # Formasyonlar: isim bazli upsert (her zaman guncel tutulur)
        existing = {
            f.name: f for f in (await session.execute(select(Formation))).scalars().all()
        }
        for data in FORMATIONS:
            if data["name"] in existing:
                existing[data["name"]].position_slots = data["position_slots"]
            else:
                session.add(Formation(**data))
        await session.commit()

        club_count = (await session.execute(select(Club.id).limit(1))).first()
        if club_count is not None:
            print("Kulup verisi zaten mevcut, seed atlandi. (--force ile sifirlayabilirsiniz)")
            return

        now = datetime.now(timezone.utc)
        total_players = 0
        for club_data in CLUBS:
            club = Club(
                external_api_football_id=club_data["api_id"],
                name=club_data["name"],
                short_name=club_data["short"],
                logo_url=f"https://media.api-sports.io/football/teams/{club_data['api_id']}.png",
                league=club_data["league"],
                country=club_data["country"],
            )
            session.add(club)
            await session.flush()

            coach_name, coach_nat = club_data["coach"]
            session.add(Coach(name=coach_name, nationality=coach_nat, club_id=club.id))

            for name, role, detail, age, jersey, nation, value_m in club_data["players"]:
                session.add(
                    Player(
                        name=name,
                        position=role,
                        detail_position=detail,
                        age=age,
                        jersey_number=jersey,
                        nationality=nation,
                        club_id=club.id,
                        market_value=int(value_m * 1_000_000),
                        market_value_updated_at=now,
                    )
                )
                total_players += 1

        await session.commit()
        print(f"{len(CLUBS)} kulup, {total_players} oyuncu, {len(FORMATIONS)} formasyon eklendi.")


if __name__ == "__main__":
    asyncio.run(seed(force="--force" in sys.argv))
