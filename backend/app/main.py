import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import admin, clubs, formations, games, lineups, players, stats
from .scheduler import create_scheduler

logging.basicConfig(level=logging.INFO)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Gelistirme kolayligi: tablolar yoksa olusturulur (prod'da Alembic kullanin)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    scheduler = create_scheduler()
    if scheduler:
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="İlk Onbir API",
    description="Gercek kadrolarla ilk onbir kurma uygulamasi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clubs.router)
app.include_router(players.router)
app.include_router(formations.router)
app.include_router(lineups.router)
app.include_router(stats.router)
app.include_router(games.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
