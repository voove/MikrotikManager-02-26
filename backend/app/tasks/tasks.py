import asyncio
from datetime import datetime, timezone
from app.tasks.celery_app import celery_app
from app.services.ssh import run_ssh_command, test_connectivity
from app.scripts.routeros import get_script, parse_kv_output
from app.core.config import settings


def run_async(coro):
    """Run an async function from sync Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.tasks.tasks.heartbeat_all_routers", bind=True)
def heartbeat_all_routers(self):
    """Poll all active routers and update their online status + metrics."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.models.models import Router
    from app.core.influx import get_write_api
    from influxdb_client import Point

    # Use sync engine for Celery
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    from sqlalchemy import create_engine as sync_engine_create
    engine = sync_engine_create(sync_url)

    with Session(engine) as session:
        routers = session.execute(select(Router).where(Router.is_active == True)).scalars().all()
        write_api = get_write_api()

        for router in routers:
            try:
                is_online, latency_ms = run_async(
                    test_connectivity(
                        router.ip_address,
                        port=router.ssh_port,
                        username=router.ssh_user,
                        password=router.ssh_password,
                    )
                )

                was_online = router.is_online
                router.is_online = is_online
                if is_online:
                    router.last_seen = datetime.now(timezone.utc)

                    # Write heartbeat to InfluxDB
                    point = (
                        Point("heartbeat")
                        .tag("router_id", str(router.id))
                        .tag("router_name", router.name)
                        .field("latency_ms", latency_ms)
                        .field("online", 1)
                    )
                    write_api.write(bucket=settings.INFLUX_BUCKET, org=settings.INFLUX_ORG, record=point)

                    # If just came back online, pull signal metrics
                    if not was_online:
                        poll_signal_metrics.delay(router.id)
                else:
                    point = (
                        Point("heartbeat")
                        .tag("router_id", str(router.id))
                        .tag("router_name", router.name)
                        .field("online", 0)
                    )
                    write_api.write(bucket=settings.INFLUX_BUCKET, org=settings.INFLUX_ORG, record=point)

                    # Create alert if just went offline
                    if was_online:
                        _create_offline_alert(session, router)

                session.commit()

            except Exception as e:
                print(f"Heartbeat error for {router.name}: {e}")


@celery_app.task(name="app.tasks.tasks.poll_signal_metrics")
def poll_signal_metrics(router_id: int):
    """Pull LTE signal metrics and store in InfluxDB."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.models.models import Router
    from app.core.influx import get_write_api
    from influxdb_client import Point

    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    from sqlalchemy import create_engine as sync_engine_create
    engine = sync_engine_create(sync_url)

    with Session(engine) as session:
        router = session.get(Router, router_id)
        if not router or not router.is_online:
            return

        script = get_script("signal_strength")
        result = run_async(
            run_ssh_command(
                router.ip_address,
                script["command"],
                port=router.ssh_port,
                username=router.ssh_user,
                password=router.ssh_password,
            )
        )

        if result.success:
            data = parse_kv_output(result.stdout)
            write_api = get_write_api()
            point = Point("signal") \
                .tag("router_id", str(router.id)) \
                .tag("router_name", router.name) \
                .tag("operator", data.get("operator", "unknown")) \
                .tag("band", data.get("band", "unknown"))

            for field in ["rssi", "rsrp", "rsrq", "sinr"]:
                val = data.get(field)
                if val and val not in ("", "none"):
                    try:
                        point = point.field(field, float(val))
                    except ValueError:
                        pass

            write_api.write(bucket=settings.INFLUX_BUCKET, org=settings.INFLUX_ORG, record=point)


@celery_app.task(name="app.tasks.tasks.execute_script", bind=True)
def execute_script(self, execution_id: int):
    """Execute a RouterOS script and save result."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.models.models import ScriptExecution, Router
    from datetime import timezone

    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    from sqlalchemy import create_engine as sync_engine_create
    engine = sync_engine_create(sync_url)

    with Session(engine) as session:
        execution = session.get(ScriptExecution, execution_id)
        if not execution:
            return

        router = session.get(Router, execution.router_id)
        if not router:
            return

        execution.status = "running"
        session.commit()

        script = get_script(execution.script_name)
        if not script:
            execution.status = "error"
            execution.error = f"Unknown script: {execution.script_name}"
            execution.completed_at = datetime.now(timezone.utc)
            session.commit()
            return

        result = run_async(
            run_ssh_command(
                router.ip_address,
                script["command"],
                port=router.ssh_port,
                username=router.ssh_user,
                password=router.ssh_password,
            )
        )

        execution.status = "success" if result.success else "error"
        execution.output = result.stdout
        execution.error = result.stderr if not result.success else None
        execution.duration_ms = result.duration_ms
        execution.completed_at = datetime.now(timezone.utc)
        session.commit()

        # Store signal data in InfluxDB if it was a signal script
        if execution.script_name == "signal_strength" and result.success:
            poll_signal_metrics.delay(router.id)

        return {"status": execution.status, "output": execution.output}


def _create_offline_alert(session, router):
    from app.models.models import Alert
    alert = Alert(
        router_id=router.id,
        alert_type="offline",
        message=f"Router {router.name} went offline",
        severity="critical",
    )
    session.add(alert)
