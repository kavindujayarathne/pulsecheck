import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Incident, Service, User, get_db
from deps import get_current_user
from schemas import IncidentResponse

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    service_id: uuid.UUID | None = Query(default=None),
    type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_service_ids = select(Service.id).where(Service.user_id == user.id)

    query = db.query(Incident).filter(Incident.service_id.in_(user_service_ids))

    if service_id is not None:
        query = query.filter(Incident.service_id == service_id)
    if type is not None:
        query = query.filter(Incident.type == type)
    if status == "open":
        query = query.filter(Incident.resolved_at.is_(None))
    elif status == "resolved":
        query = query.filter(Incident.resolved_at.is_not(None))

    incidents = query.order_by(Incident.started_at.desc()).offset(offset).limit(limit).all()
    return incidents
