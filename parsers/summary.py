from __future__ import annotations

from .base import (
    ParsedComponent,
    ParsedIncident,
    ParsedScheduledMaintenance,
    ParsedStatusPage,
    parse_iso,
)

_STATUS_MAP = {
    "operational": "up",
    "up": "up",
    "degradedperformance": "degraded",
    "degraded": "degraded",
    "partialoutage": "down",
    "majoroutage": "down",
    "down": "down",
    "undermaintenance": "degraded",
    "maintenance": "degraded",
}


def _map_status(raw: str | None) -> str:
    if not raw:
        return "up"
    key = raw.strip().lower().replace("_", "").replace(" ", "")
    return _STATUS_MAP.get(key, "up")


def _unwrap_envelope(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return payload
    if "success" in payload:
        for key in ("result", "data"):
            inner = payload.get(key)
            if isinstance(inner, dict):
                return inner
    return payload


def _extract_components(body: dict) -> list[ParsedComponent]:
    raw = body.get("components")
    if not isinstance(raw, list):
        return []

    group_names: dict[str, str] = {}
    for c in raw:
        if not isinstance(c, dict):
            continue
        if c.get("group") is True:
            cid = c.get("id")
            if cid:
                group_names[cid] = c.get("name") or ""
        elif isinstance(c.get("group"), dict):
            g = c["group"]
            gid = g.get("id")
            if gid:
                group_names[gid] = g.get("name") or ""

    components: list[ParsedComponent] = []
    for c in raw:
        if not isinstance(c, dict):
            continue
        if c.get("group") is True:
            continue

        group_name: str | None = None
        gid = c.get("group_id")
        if gid and gid in group_names:
            group_name = group_names[gid]
        elif isinstance(c.get("group"), dict):
            group_name = c["group"].get("name")

        components.append(
            ParsedComponent(
                name=c.get("name") or "",
                status=_map_status(c.get("status")),
                group_name=group_name,
            )
        )
    return components


def _extract_incidents(body: dict) -> list[ParsedIncident] | None:
    key = next((k for k in ("incidents", "active_incidents") if k in body), None)
    if key is None:
        return None
    out: list[ParsedIncident] = []
    for i in body.get(key) or []:
        if not isinstance(i, dict):
            continue
        out.append(
            ParsedIncident(
                name=i.get("name") or "",
                impact=str(i.get("impact") or "none").lower(),
                started_at=parse_iso(i.get("started_at") or i.get("created_at")),
                url=i.get("shortlink") or i.get("url"),
                affected_components=[
                    comp.get("name") or ""
                    for comp in (i.get("components") or [])
                    if isinstance(comp, dict)
                ],
            )
        )
    return out


def _extract_scheduled(body: dict) -> list[ParsedScheduledMaintenance] | None:
    key = next(
        (k for k in ("scheduled_maintenances", "scheduled_maintenance") if k in body),
        None,
    )
    if key is None:
        return None
    out: list[ParsedScheduledMaintenance] = []
    for s in body.get(key) or []:
        if not isinstance(s, dict):
            continue
        out.append(
            ParsedScheduledMaintenance(
                name=s.get("name") or "",
                status=str(s.get("status") or "scheduled").lower(),
                scheduled_for=parse_iso(s.get("scheduled_for")),
                scheduled_until=parse_iso(s.get("scheduled_until")),
                affected_components=[
                    comp.get("name") or ""
                    for comp in (s.get("components") or [])
                    if isinstance(comp, dict)
                ],
            )
        )
    return out


def parse(payload: dict) -> ParsedStatusPage:
    body = _unwrap_envelope(payload)
    return ParsedStatusPage(
        components=_extract_components(body),
        incidents=_extract_incidents(body),
        scheduled_maintenances=_extract_scheduled(body),
    )


def merge(pages: list[ParsedStatusPage]) -> ParsedStatusPage:
    # Dedup safety net for cases where multiple URLs route through here with
    # overlapping payloads (notably user_defined_urls where the same component
    # may appear in more than one source). Discover applies the source-of-truth
    # split before reaching merge, so dedup is rarely exercised in that path.
    components: list[ParsedComponent] = []
    seen: set[tuple[str | None, str]] = set()
    incidents: list[ParsedIncident] | None = None
    scheduled: list[ParsedScheduledMaintenance] | None = None

    for p in pages:
        for c in p.components:
            key = (c.group_name, c.name)
            if key in seen:
                continue
            seen.add(key)
            components.append(c)
        if incidents is None and p.incidents is not None:
            incidents = p.incidents
        if scheduled is None and p.scheduled_maintenances is not None:
            scheduled = p.scheduled_maintenances

    return ParsedStatusPage(
        components=components,
        incidents=incidents,
        scheduled_maintenances=scheduled,
    )
