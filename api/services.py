import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import Check, Service, User, get_db
from deps import get_current_user
from schemas import (
    CheckResponse,
    ServiceCreate,
    ServiceDetailResponse,
    ServiceResponse,
    ServiceUpdate,
    UptimeStats,
)

router = APIRouter(prefix="/api/services", tags=["services"])


def _get_user_service(service_id: uuid.UUID, user: User, db: Session) -> Service:
    service = db.query(Service).filter(Service.id == service_id, Service.user_id == user.id).first()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


def _calculate_uptime(db: Session, service_id: uuid.UUID, since: datetime) -> float | None:
    total = db.query(func.count(Check.id)).filter(
        Check.service_id == service_id,
        Check.checked_at >= since,
    ).scalar()
    if not total:
        return None
    up = db.query(func.count(Check.id)).filter(
        Check.service_id == service_id,
        Check.checked_at >= since,
        Check.status == "up",
    ).scalar()
    return round((up / total) * 100, 2)


@router.get("", response_model=list[ServiceResponse])
def list_services(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    services = db.query(Service).filter(Service.user_id == user.id).order_by(Service.created_at).all()
    return services


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = Service(
        user_id=user.id,
        name=payload.name,
        url=str(payload.url),
        category=payload.category,
        check_interval=payload.check_interval,
        status_page_url=str(payload.status_page_url) if payload.status_page_url else None,
        expected_status=payload.expected_status,
        timeout_ms=payload.timeout_ms,
        degraded_threshold_ms=payload.degraded_threshold_ms,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/{service_id}", response_model=ServiceDetailResponse)
def get_service(
    service_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = _get_user_service(service_id, user, db)
    now = datetime.now(timezone.utc)
    uptime = UptimeStats(
        uptime_24h=_calculate_uptime(db, service.id, now - timedelta(hours=24)),
        uptime_7d=_calculate_uptime(db, service.id, now - timedelta(days=7)),
        uptime_30d=_calculate_uptime(db, service.id, now - timedelta(days=30)),
    )
    service_data = ServiceResponse.model_validate(service).model_dump()
    service_data["uptime"] = uptime
    return service_data


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = _get_user_service(service_id, user, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in ("url", "status_page_url") and value is not None:
            value = str(value)
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = _get_user_service(service_id, user, db)
    db.delete(service)
    db.commit()


@router.get("/{service_id}/checks", response_model=list[CheckResponse])
def list_checks(
    service_id: uuid.UUID,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_user_service(service_id, user, db)
    checks = (
        db.query(Check)
        .filter(Check.service_id == service_id)
        .order_by(Check.checked_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return checks
