from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Router, ScriptExecution
from app.schemas.schemas import RouterCreate, RouterUpdate, RouterResponse, ExecuteScriptRequest, ExecutionResponse
from app.scripts.routeros import list_scripts, get_script
from app.tasks.tasks import execute_script
from datetime import datetime, timezone

router = APIRouter(prefix="/routers", tags=["routers"])


@router.get("/", response_model=list[RouterResponse])
async def list_routers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Router).order_by(Router.name))
    return result.scalars().all()


@router.post("/", response_model=RouterResponse)
async def create_router(data: RouterCreate, db: AsyncSession = Depends(get_db)):
    r = Router(**data.model_dump())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@router.get("/{router_id}", response_model=RouterResponse)
async def get_router(router_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(Router, router_id)
    if not r:
        raise HTTPException(404, "Router not found")
    return r


@router.patch("/{router_id}", response_model=RouterResponse)
async def update_router(router_id: int, data: RouterUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.get(Router, router_id)
    if not r:
        raise HTTPException(404, "Router not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


@router.delete("/{router_id}")
async def delete_router(router_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(Router, router_id)
    if not r:
        raise HTTPException(404, "Router not found")
    await db.delete(r)
    await db.commit()
    return {"deleted": True}


@router.get("/{router_id}/executions", response_model=list[ExecutionResponse])
async def get_executions(router_id: int, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScriptExecution)
        .where(ScriptExecution.router_id == router_id)
        .order_by(ScriptExecution.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{router_id}/execute", response_model=ExecutionResponse)
async def run_script(router_id: int, req: ExecuteScriptRequest, db: AsyncSession = Depends(get_db)):
    r = await db.get(Router, router_id)
    if not r:
        raise HTTPException(404, "Router not found")
    if not r.is_online:
        raise HTTPException(400, "Router is currently offline")

    script = get_script(req.script_name)
    if not script:
        raise HTTPException(404, f"Script '{req.script_name}' not found")

    execution = ScriptExecution(
        router_id=router_id,
        script_name=req.script_name,
        triggered_by=req.triggered_by,
        triggered_by_user=req.triggered_by_user,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Dispatch to Celery
    execute_script.delay(execution.id)

    return execution


@router.get("/scripts/list")
async def get_scripts():
    return list_scripts()
