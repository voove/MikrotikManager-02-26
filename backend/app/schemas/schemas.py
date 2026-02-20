from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# --- Router ---

class RouterCreate(BaseModel):
    name: str
    ip_address: str
    ssh_port: int = 22
    ssh_user: str = "admin"
    ssh_password: Optional[str] = None
    ssh_key: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[dict] = None


class RouterUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_password: Optional[str] = None
    ssh_key: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[dict] = None
    is_active: Optional[bool] = None


class RouterResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    ssh_port: int
    ssh_user: str
    location: Optional[str]
    notes: Optional[str]
    tags: Optional[dict]
    is_active: bool
    last_seen: Optional[datetime]
    is_online: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Auth ---

class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Script Execution ---

class ExecuteScriptRequest(BaseModel):
    router_id: int
    script_name: str
    triggered_by: str = "ui"
    triggered_by_user: Optional[str] = None


class ExecutionResponse(BaseModel):
    id: int
    router_id: int
    script_name: str
    triggered_by: str
    status: str
    output: Optional[str]
    error: Optional[str]
    duration_ms: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# --- Alerts ---

class AlertResponse(BaseModel):
    id: int
    router_id: int
    alert_type: str
    message: str
    severity: str
    resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Metrics ---

class MetricPoint(BaseModel):
    time: str
    value: float


class SignalMetrics(BaseModel):
    router_id: int
    router_name: str
    rssi: list[MetricPoint] = []
    rsrp: list[MetricPoint] = []
    rsrq: list[MetricPoint] = []
    sinr: list[MetricPoint] = []


class HeartbeatMetrics(BaseModel):
    router_id: int
    router_name: str
    latency: list[MetricPoint] = []
    uptime_pct: float = 0.0
