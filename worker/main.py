import json
import os
import time
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.base import SessionLocal, engine
from db.models import Check, Incident, Service
from parsers import ParsedStatusPage, fetch_and_parse
from parsers.utils import decode_api_urls

REDIS_URL = os.environ["REDIS_URL"]
TICK_INTERVAL = 10  # seconds between scheduler ticks
STATUS_PAGE_FETCH_INTERVAL = 60  # seconds between fetches per unique status page URL set
HEARTBEAT_FILE = Path("/tmp/healthy")

redis_client = redis.from_url(REDIS_URL)


def verify_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection verified.")
    except Exception as e:
        print(f"ERROR: Cannot connect to database: {e}")
        raise


def verify_redis():
    try:
        redis_client.ping()
        print("Redis connection verified.")
    except Exception as e:
        print(f"ERROR: Cannot connect to Redis: {e}")
        raise


def get_previous_status(service_id: str) -> str | None:
    cached = redis_client.get(f"service:{service_id}:status")
    if cached is None:
        return None
    data = json.loads(cached)
    return data.get("status")


def cache_status(service_id: str, status: str, response_time: int | None, checked_at: datetime) -> None:
    data = {
        "status": status,
        "response_time": response_time,
        "checked_at": checked_at.isoformat(),
    }
    redis_client.set(f"service:{service_id}:status", json.dumps(data))


def get_last_checked(service_id: str) -> datetime | None:
    cached = redis_client.get(f"service:{service_id}:status")
    if cached is None:
        return None
    data = json.loads(cached)
    checked_at = data.get("checked_at")
    if checked_at is None:
        return None
    return datetime.fromisoformat(checked_at)


def is_due(service: Service) -> bool:
    last = get_last_checked(str(service.id))
    if last is None:
        return True
    elapsed = (datetime.now(timezone.utc) - last).total_seconds()
    return elapsed >= service.check_interval


def ping_service(service: Service) -> tuple[str, int | None, int | None]:
    timeout_s = service.timeout_ms / 1000.0
    try:
        response = httpx.get(str(service.url), timeout=timeout_s, follow_redirects=True)
        response_time = int(response.elapsed.total_seconds() * 1000)
        status_code = response.status_code

        if status_code != service.expected_status:
            return "down", status_code, response_time
        if response_time >= service.degraded_threshold_ms:
            return "degraded", status_code, response_time
        return "up", status_code, response_time

    except httpx.TimeoutException:
        return "down", None, None
    except httpx.RequestError:
        return "down", None, None


def record_check(db: Session, service: Service, status: str, status_code: int | None, response_time: int | None) -> None:
    check = Check(
        service_id=service.id,
        status_code=status_code,
        response_time=response_time,
        status=status,
    )
    db.add(check)
    db.commit()


def handle_incident(db: Session, service: Service, new_status: str, previous_status: str | None) -> None:
    if previous_status in (None, "up") and new_status in ("down", "degraded"):
        incident_type = "downtime" if new_status == "down" else "degraded"
        incident = Incident(
            service_id=service.id,
            type=incident_type,
            started_at=datetime.now(timezone.utc),
            checks_failed=1,
        )
        db.add(incident)
        db.commit()
        print(f"  Incident created: {incident_type} for {service.name}")

    elif previous_status in ("down", "degraded") and new_status == "up":
        open_incident = (
            db.query(Incident)
            .filter(Incident.service_id == service.id, Incident.resolved_at.is_(None))
            .order_by(Incident.started_at.desc())
            .first()
        )
        if open_incident:
            open_incident.resolved_at = datetime.now(timezone.utc)
            db.commit()
            print(f"  Incident resolved for {service.name}")

    elif previous_status in ("down", "degraded") and new_status in ("down", "degraded"):
        open_incident = (
            db.query(Incident)
            .filter(Incident.service_id == service.id, Incident.resolved_at.is_(None))
            .order_by(Incident.started_at.desc())
            .first()
        )
        if open_incident:
            open_incident.checks_failed += 1
            db.commit()


def check_http_service(db: Session, service: Service) -> None:
    status, status_code, response_time = ping_service(service)
    now = datetime.now(timezone.utc)

    previous_status = get_previous_status(str(service.id))

    record_check(db, service, status, status_code, response_time)
    cache_status(str(service.id), status, response_time, now)
    handle_incident(db, service, status, previous_status)

    rt_display = f"{response_time}ms" if response_time is not None else "timeout"
    print(f"  {service.name}: {status} ({rt_display})")


# --- Status page pass ---


def _url_set_key(api_urls: list[str]) -> str:
    joined = "|".join(sorted(api_urls))
    return joined.replace(":", "_").replace("/", "_")


def status_page_url_set_is_due(api_urls: list[str]) -> bool:
    last = redis_client.get(f"statuspage:{_url_set_key(api_urls)}:last_fetched")
    if last is None:
        return True
    last_dt = datetime.fromisoformat(last.decode() if isinstance(last, bytes) else last)
    return (datetime.now(timezone.utc) - last_dt).total_seconds() >= STATUS_PAGE_FETCH_INTERVAL


def mark_status_page_fetched(api_urls: list[str]) -> None:
    redis_client.set(
        f"statuspage:{_url_set_key(api_urls)}:last_fetched",
        datetime.now(timezone.utc).isoformat(),
    )


def match_component_status(parsed: ParsedStatusPage, component_name: str) -> str | None:
    key = component_name.lower().strip()
    for c in parsed.components:
        if c.name.lower().strip() == key:
            return c.status
    for c in parsed.components:
        if key in c.name.lower():
            return c.status
    return None


def _serialize_dt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def cache_active_incident(service_id: str, parsed: ParsedStatusPage, component_name: str) -> None:
    """Surface the upstream-reported incident affecting this component, if any.
    Stored as JSON so the API can return it. None when no upstream incidents key
    is present (parser sets it to None) or the array is empty."""
    if parsed.incidents is None:
        return
    key_lower = component_name.lower().strip()
    chosen = None
    for inc in parsed.incidents:
        affected = [n.lower().strip() for n in inc.affected_components]
        if not affected:
            continue
        if key_lower in affected or any(key_lower in a for a in affected):
            chosen = inc
            break
    if chosen is None:
        redis_client.set(f"service:{service_id}:active_incident", json.dumps(None))
        return
    redis_client.set(
        f"service:{service_id}:active_incident",
        json.dumps({
            "name": chosen.name,
            "impact": chosen.impact,
            "started_at": _serialize_dt(chosen.started_at),
            "url": chosen.url,
        }),
    )


def cache_active_maintenance(service_id: str, parsed: ParsedStatusPage, component_name: str) -> None:
    if parsed.scheduled_maintenances is None:
        return
    key_lower = component_name.lower().strip()
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=24)
    chosen = None
    for m in parsed.scheduled_maintenances:
        affected = [n.lower().strip() for n in m.affected_components]
        if not affected:
            continue
        if not (key_lower in affected or any(key_lower in a for a in affected)):
            continue
        if m.status in ("in_progress", "verifying"):
            chosen = m
            break
        if m.status == "scheduled" and m.scheduled_for and m.scheduled_for <= soon:
            chosen = m
            break
    if chosen is None:
        redis_client.set(f"service:{service_id}:active_maintenance", json.dumps(None))
        return
    redis_client.set(
        f"service:{service_id}:active_maintenance",
        json.dumps({
            "name": chosen.name,
            "status": chosen.status,
            "scheduled_for": _serialize_dt(chosen.scheduled_for),
            "scheduled_until": _serialize_dt(chosen.scheduled_until),
        }),
    )


def apply_status_to_service(db: Session, service: Service, status: str, parsed: ParsedStatusPage) -> None:
    """Apply a fresh component status to a status_page service.

    If the upstream payload included an `incidents` key, we surface those active
    incidents directly and skip our internal incident creation (avoids
    duplicating what upstream already tracks). When the key is absent (parser
    returned None for incidents), we fall back to internal detection so the
    service still has a record of what's currently down.
    """
    now = datetime.now(timezone.utc)
    previous_status = get_previous_status(str(service.id))

    record_check(db, service, status, None, None)
    cache_status(str(service.id), status, None, now)

    if parsed.incidents is None:
        handle_incident(db, service, status, previous_status)

    cache_active_incident(str(service.id), parsed, service.component_name)
    cache_active_maintenance(str(service.id), parsed, service.component_name)

    print(f"  {service.name}: {status} (status page)")


def status_page_pass(db: Session) -> None:
    services = (
        db.query(Service)
        .filter(
            Service.monitor_type == "status_page",
            Service.status_page_api_urls.isnot(None),
            Service.component_name.isnot(None),
        )
        .all()
    )
    if not services:
        return

    # One fetch per unique URL-set per cycle. Different services that monitor
    # the same status page share a fetch.
    batches: dict[tuple[str, ...], list[Service]] = {}
    for s in services:
        standard = decode_api_urls(s.status_page_api_urls)
        user_defined = decode_api_urls(s.user_defined_urls)
        urls = tuple(standard or user_defined)
        if not urls:
            continue
        batches.setdefault(urls, []).append(s)

    for url_tuple, batch in batches.items():
        urls = list(url_tuple)
        if not status_page_url_set_is_due(urls):
            continue

        print(f"Fetching status page {urls}...")
        try:
            parsed = fetch_and_parse(urls)
        except Exception as e:
            print(f"  ERROR fetching {urls}: {e}")
            empty = ParsedStatusPage()
            for svc in batch:
                apply_status_to_service(db, svc, "down", empty)
            mark_status_page_fetched(urls)
            continue

        mark_status_page_fetched(urls)

        if not parsed.components:
            print(f"  No components returned from {urls}")
            for svc in batch:
                apply_status_to_service(db, svc, "down", parsed)
            continue

        for svc in batch:
            mapped = match_component_status(parsed, svc.component_name)
            if mapped is None:
                print(f"  Component '{svc.component_name}' not found in {urls}")
                mapped = "down"
            apply_status_to_service(db, svc, mapped, parsed)


# --- HTTP ping pass ---


def http_ping_pass(db: Session) -> None:
    services = (
        db.query(Service)
        .filter(Service.monitor_type == "http_ping")
        .all()
    )
    if not services:
        return

    due = [s for s in services if is_due(s) and s.url]
    if not due:
        return

    print(f"Pinging {len(due)} HTTP service(s)...")
    for service in due:
        check_http_service(db, service)


def tick():
    db = SessionLocal()
    try:
        status_page_pass(db)
        http_ping_pass(db)
    finally:
        db.close()


def main():
    print("PulseCheck worker started")
    verify_db()
    verify_redis()
    HEARTBEAT_FILE.touch()

    while True:
        try:
            tick()
        except Exception as e:
            print(f"ERROR in tick: {e}")
        HEARTBEAT_FILE.touch()
        time.sleep(TICK_INTERVAL)


if __name__ == "__main__":
    main()
