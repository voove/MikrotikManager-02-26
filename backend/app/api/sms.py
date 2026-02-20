from fastapi import APIRouter, Form, Request, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Router, ScriptExecution
from app.services.sms import (
    parse_sms_command,
    send_sms,
    is_whitelisted,
    validate_twilio_request,
    HELP_MESSAGE,
)
from app.tasks.tasks import execute_script
from app.core.config import settings

router = APIRouter(prefix="/sms", tags=["sms"])


@router.post("/inbound", response_class=PlainTextResponse)
async def inbound_sms(
    request: Request,
    From: str = Form(...),
    Body: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate Twilio signature
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    form_data = dict(await request.form())
    if not validate_twilio_request(url, form_data, signature):
        raise HTTPException(403, "Invalid Twilio signature")

    # Whitelist check
    if not is_whitelisted(From):
        return "Unauthorized number."

    body = Body.strip()

    if body.upper() in ("HELP", "?", ""):
        send_sms(From, HELP_MESSAGE)
        return "ok"

    script_name, router_identifier = parse_sms_command(body)

    if not script_name:
        send_sms(From, f"Unknown command. Send HELP for list of commands.")
        return "ok"

    if not router_identifier:
        send_sms(From, "Please specify a router. Example: SIGNAL R01")
        return "ok"

    # Find router by name or IP
    result = await db.execute(
        select(Router).where(
            Router.is_active == True,
            (Router.name.ilike(f"%{router_identifier}%")) |
            (Router.ip_address == router_identifier)
        )
    )
    target_router = result.scalar_one_or_none()

    if not target_router:
        send_sms(From, f"Router '{router_identifier}' not found.")
        return "ok"

    if not target_router.is_online:
        send_sms(From, f"{target_router.name} is currently OFFLINE.")
        return "ok"

    # Create execution record
    execution = ScriptExecution(
        router_id=target_router.id,
        script_name=script_name,
        triggered_by="sms",
        triggered_by_user=From,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Send acknowledgement
    send_sms(From, f"Running {script_name.upper()} on {target_router.name}... Reply in ~30s.")

    # Dispatch task with SMS callback
    execute_script_with_sms_reply.delay(execution.id, From)

    return "ok"


@router.post("/broadcast")
async def broadcast_sms(
    message: str,
    phone_numbers: list[str],
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an SMS alert to multiple numbers (for offline alerts etc)."""
    for number in phone_numbers:
        if is_whitelisted(number):
            send_sms(number, message)
    return {"sent": len(phone_numbers)}


# Celery task for SMS reply
from app.tasks.celery_app import celery_app
from app.services.ssh import run_ssh_command
from app.scripts.routeros import get_script, parse_kv_output


@celery_app.task(name="app.api.sms.execute_script_with_sms_reply")
def execute_script_with_sms_reply(execution_id: int, reply_to: str):
    """Execute script and send result via SMS."""
    import asyncio
    from sqlalchemy.orm import Session
    from app.models.models import ScriptExecution, Router
    from app.core.database import get_sync_engine
    from datetime import datetime, timezone

    engine = get_sync_engine()

    with Session(engine) as session:
        execution = session.get(ScriptExecution, execution_id)
        router = session.get(Router, execution.router_id)
        script = get_script(execution.script_name)

        execution.status = "running"
        session.commit()

        result = asyncio.run(run_ssh_command(
            router.ip_address,
            script["command"],
            port=router.ssh_port,
            username=router.ssh_user,
            password=router.ssh_password,
        ))

        execution.status = "success" if result.success else "error"
        execution.output = result.stdout
        execution.error = result.stderr if not result.success else None
        execution.duration_ms = result.duration_ms
        execution.completed_at = datetime.now(timezone.utc)
        session.commit()

        # Format SMS reply (160 char chunks)
        if result.success:
            data = parse_kv_output(result.stdout)
            lines = [f"✓ {router.name} - {execution.script_name.upper()}"]
            for k, v in list(data.items())[:8]:
                lines.append(f"{k}: {v}")
            message = "\n".join(lines)[:1500]
        else:
            message = f"✗ Error on {router.name}:\n{result.stderr[:200]}"

        send_sms(reply_to, message)
