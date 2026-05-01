from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ParsedComponent:
    name: str
    status: str  # "up" | "degraded" | "down"
    group_name: str | None = None


@dataclass
class ParsedIncident:
    name: str
    impact: str  # "minor" | "major" | "critical" | "maintenance" | "none"
    started_at: datetime | None = None
    url: str | None = None
    affected_components: list[str] = field(default_factory=list)


@dataclass
class ParsedScheduledMaintenance:
    name: str
    status: str  # "scheduled" | "in_progress" | "verifying" | "completed"
    scheduled_for: datetime | None = None
    scheduled_until: datetime | None = None
    affected_components: list[str] = field(default_factory=list)


# incidents / scheduled_maintenances is None when the source payload didn't
# include the key at all (different from []: "supported, none active right now").
# Worker uses None vs [] to decide whether to fall back to internal incident detection.
@dataclass
class ParsedStatusPage:
    components: list[ParsedComponent] = field(default_factory=list)
    incidents: list[ParsedIncident] | None = None
    scheduled_maintenances: list[ParsedScheduledMaintenance] | None = None


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
