from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, HttpUrl


# --- Service schemas ---


class ServiceCreate(BaseModel):
    name: str
    url: HttpUrl
    category: str | None = None
    check_interval: int = 30
    status_page_url: HttpUrl | None = None
    expected_status: int = 200
    timeout_ms: int = 5000
    degraded_threshold_ms: int = 1000


class ServiceUpdate(BaseModel):
    name: str | None = None
    url: HttpUrl | None = None
    category: str | None = None
    check_interval: int | None = None
    status_page_url: HttpUrl | None = None
    expected_status: int | None = None
    timeout_ms: int | None = None
    degraded_threshold_ms: int | None = None


class ServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    category: str | None
    check_interval: int
    status_page_url: str | None
    expected_status: int
    timeout_ms: int
    degraded_threshold_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UptimeStats(BaseModel):
    uptime_24h: float | None
    uptime_7d: float | None
    uptime_30d: float | None


class ServiceDetailResponse(ServiceResponse):
    uptime: UptimeStats


# --- Check schemas ---


class CheckResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    status_code: int | None
    response_time: int | None
    status: str
    checked_at: datetime

    model_config = {"from_attributes": True}


# --- Incident schemas ---


class IncidentResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    type: str
    started_at: datetime
    resolved_at: datetime | None
    checks_failed: int

    model_config = {"from_attributes": True}
