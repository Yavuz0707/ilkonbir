from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..services.records_service import (
    computed_records,
    filter_records,
    get_record,
    list_groups,
    summarize_record,
)

router = APIRouter(prefix="/records", tags=["records"])


@router.get("")
async def records(q: str | None = None, group_id: str | None = None):
    rows = filter_records(group_id=group_id, q=q)
    return {"records": [summarize_record(record) for record in rows]}


@router.get("/categories")
async def record_categories():
    return {"groups": list_groups(), "records": [summarize_record(record) for record in filter_records()]}


@router.get("/search")
async def search_records(q: str = Query(..., min_length=2)):
    return {"records": [summarize_record(record) for record in filter_records(q=q)]}


@router.get("/group/{group_id}")
async def records_by_group(group_id: str):
    rows = filter_records(group_id=group_id)
    return {"records": [summarize_record(record) for record in rows]}


@router.get("/ilkonbir/computed")
async def ilkonbir_computed_records(session: AsyncSession = Depends(get_session)):
    rows = await computed_records(session)
    return {"records": rows}


@router.get("/{record_id}")
async def record_detail(record_id: str):
    record = get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Rekor bulunamadı")
    return record
