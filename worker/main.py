import json
import os
import time
from datetime import datetime, timezone

import httpx
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.base import SessionLocal, engine
from db.models import Check, Incident, Service

REDIS_URL = os.environ["REDIS_URL"]
TICK_INTERVAL = 10  # seconds between scheduler ticks

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


def check_service(db: Session, service: Service) -> None:
    status, status_code, response_time = ping_service(service)
    now = datetime.now(timezone.utc)

    previous_status = get_previous_status(str(service.id))

    record_check(db, service, status, status_code, response_time)
    cache_status(str(service.id), status, response_time, now)
    handle_incident(db, service, status, previous_status)

    rt_display = f"{response_time}ms" if response_time is not None else "timeout"
    print(f"  {service.name}: {status} ({rt_display})")


def tick():
    db = SessionLocal()
    try:
        services = db.query(Service).all()
        if not services:
            return

        due = [s for s in services if is_due(s)]
        if not due:
            return

        print(f"Checking {len(due)} service(s)...")
        for service in due:
            check_service(db, service)
    finally:
        db.close()


def main():
    print("PulseCheck worker started")
    verify_db()
    verify_redis()

    while True:
        try:
            tick()
        except Exception as e:
            print(f"ERROR in tick: {e}")
        time.sleep(TICK_INTERVAL)


if __name__ == "__main__":
    main()
