import asyncio
from datetime import datetime, timezone
from celery import Celery
from celery.schedules import crontab
from redbeat import RedBeatScheduler
from app.core.config import settings

celery_app = Celery(
    "mikrotik_manager",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    beat_scheduler="redbeat.RedBeatScheduler",
    beat_schedule={
        "heartbeat-all-routers": {
            "task": "app.tasks.tasks.heartbeat_all_routers",
            "schedule": 60.0,  # every 60 seconds
        },
    },
)
