from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl, model_validator


# --- Service schemas ---


MonitorType = Literal["http_ping", "status_page"]


class ServiceCreate(BaseModel):
    name: str
    monitor_type: MonitorType = "http_ping"
    url: HttpUrl | None = None
    status_page_api_urls: list[HttpUrl] | None = None
    user_defined_urls: list[HttpUrl] | None = None
    component_name: str | None = None
    category: str | None = None
    check_interval: int = 30
    status_page_url: HttpUrl | None = None
    expected_status: int = 200
    timeout_ms: int = 5000
    degraded_threshold_ms: int = 1000

    @model_validator(mode="after")
    def _validate_monitor_type(self):
        if self.monitor_type == "http_ping":
            if self.url is None:
                raise ValueError("url is required when monitor_type is 'http_ping'")
        elif self.monitor_type == "status_page":
            if not self.status_page_api_urls and not self.user_defined_urls:
                raise ValueError(
                    "status_page requires either status_page_api_urls or user_defined_urls"
                )
            if not self.component_name:
                raise ValueError("missing required fields for status_page: component_name")
        return self


class ServiceUpdate(BaseModel):
    name: str | None = None
    url: HttpUrl | None = None
    category: str | None = None
    check_interval: int | None = None
    status_page_url: HttpUrl | None = None
    expected_status: int | None = None
    timeout_ms: int | None = None
    degraded_threshold_ms: int | None = None


class CurrentStatus(BaseModel):
    status: str | None = None
    response_time: int | None = None
    checked_at: datetime | None = None


class DayUptime(BaseModel):
    date: str
    status: str


class ActiveIncident(BaseModel):
    name: str
    impact: str
    started_at: datetime | None = None
    url: str | None = None


class ActiveScheduledMaintenance(BaseModel):
    name: str
    status: str
    scheduled_for: datetime | None = None
    scheduled_until: datetime | None = None


class ServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    monitor_type: str
    url: str | None
    status_page_api_urls: list[str] | None = None
    user_defined_urls: list[str] | None = None
    component_name: str | None
    category: str | None
    check_interval: int
    status_page_url: str | None
    expected_status: int
    timeout_ms: int
    degraded_threshold_ms: int
    created_at: datetime
    current_status: CurrentStatus = CurrentStatus()
    uptime_24h: float | None = None
    uptime_30d_bar: list[DayUptime] = []
    active_incident: ActiveIncident | None = None
    active_maintenance: ActiveScheduledMaintenance | None = None

    model_config = {"from_attributes": True}


class UptimeStats(BaseModel):
    uptime_24h: float | None
    uptime_7d: float | None
    uptime_30d: float | None


class ServiceDetailResponse(ServiceResponse):
    uptime: UptimeStats


# --- Status page discovery ---


class DiscoverRequest(BaseModel):
    url: HttpUrl


class ValidateUrlsRequest(BaseModel):
    urls: list[HttpUrl]


class DiscoverComponent(BaseModel):
    name: str
    status: str
    group_name: str | None = None


class DiscoverResponse(BaseModel):
    api_urls: list[str]
    components: list[DiscoverComponent]


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
