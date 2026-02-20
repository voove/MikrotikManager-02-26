import re
from fastapi import APIRouter, Query, Depends, HTTPException
from app.core.influx import get_query_api
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/metrics", tags=["metrics"])

_RANGE_PATTERN = re.compile(r"^[1-9][0-9]{0,3}(m|h|d|w)$")


def validate_range(range_: str) -> str:
    if not _RANGE_PATTERN.match(range_):
        raise ValueError(f"Invalid range: {range_!r}")
    return range_


def _flux_query(router_id: int, measurement: str, field: str, range_: str) -> list[dict]:
    range_ = validate_range(range_)
    query_api = get_query_api()
    query = f"""
    from(bucket: "{settings.INFLUX_BUCKET}")
      |> range(start: -{range_})
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> filter(fn: (r) => r.router_id == "{router_id}")
      |> filter(fn: (r) => r._field == "{field}")
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
      |> yield(name: "mean")
    """
    tables = query_api.query(query, org=settings.INFLUX_ORG)
    points = []
    for table in tables:
        for record in table.records:
            points.append({
                "time": record.get_time().isoformat(),
                "value": round(record.get_value() or 0, 2),
            })
    return points


@router.get("/{router_id}/signal")
async def get_signal_metrics(
    router_id: int,
    user: dict = Depends(get_current_user),
    range: str = Query("24h", description="Time range e.g. 1h, 6h, 24h, 7d"),
):
    try:
        validate_range(range)
    except ValueError:
        raise HTTPException(400, "Invalid range format. Use e.g. 1h, 6h, 24h, 7d")

    fields = ["rssi", "rsrp", "rsrq", "sinr"]
    result = {}
    for field in fields:
        result[field] = _flux_query(router_id, "signal", field, range)
    return {"router_id": router_id, "range": range, **result}


@router.get("/{router_id}/heartbeat")
async def get_heartbeat_metrics(
    router_id: int,
    user: dict = Depends(get_current_user),
    range: str = Query("24h"),
):
    try:
        validate_range(range)
    except ValueError:
        raise HTTPException(400, "Invalid range format. Use e.g. 1h, 6h, 24h, 7d")

    latency = _flux_query(router_id, "heartbeat", "latency_ms", range)

    # Calculate uptime %
    query_api = get_query_api()
    uptime_query = f"""
    from(bucket: "{settings.INFLUX_BUCKET}")
      |> range(start: -{range})
      |> filter(fn: (r) => r._measurement == "heartbeat")
      |> filter(fn: (r) => r.router_id == "{router_id}")
      |> filter(fn: (r) => r._field == "online")
      |> mean()
    """
    tables = query_api.query(uptime_query, org=settings.INFLUX_ORG)
    uptime_pct = 0.0
    for table in tables:
        for record in table.records:
            uptime_pct = round((record.get_value() or 0) * 100, 1)

    return {
        "router_id": router_id,
        "range": range,
        "latency": latency,
        "uptime_pct": uptime_pct,
    }


@router.get("/summary")
async def get_all_routers_summary(user: dict = Depends(get_current_user)):
    """Latest signal snapshot for all routers (for dashboard cards)."""
    query_api = get_query_api()
    query = f"""
    from(bucket: "{settings.INFLUX_BUCKET}")
      |> range(start: -10m)
      |> filter(fn: (r) => r._measurement == "signal")
      |> filter(fn: (r) => r._field == "rssi" or r._field == "rsrp")
      |> last()
      |> group(columns: ["router_id", "router_name", "_field"])
    """
    tables = query_api.query(query, org=settings.INFLUX_ORG)
    result = {}
    for table in tables:
        for record in table.records:
            rid = record["router_id"]
            if rid not in result:
                result[rid] = {"router_id": rid, "router_name": record.values.get("router_name", "")}
            result[rid][record.get_field()] = record.get_value()
    return list(result.values())
