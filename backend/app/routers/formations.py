from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Formation
from ..schemas import FormationOut

router = APIRouter(prefix="/formations", tags=["formations"])


@router.get("", response_model=list[FormationOut])
async def list_formations(session: AsyncSession = Depends(get_session)):
    return (await session.execute(select(Formation).order_by(Formation.id))).scalars().all()
