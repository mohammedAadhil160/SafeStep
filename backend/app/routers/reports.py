"""
SafeStep — /reports router
User report submission + retrieval (crowdsourcing engine)
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
import logging
import uuid

from app.database import get_db
from app.models import UserReport, Incident
from app.schemas import ReportCreate, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger("safestep.reports")


async def _update_incident_from_report(db: AsyncSession, report: UserReport):
    """
    Background task: promote a verified report to an Incident record
    and trigger a safety model retrain signal.
    """
    try:
        incident = Incident(
            id=uuid.uuid4(),
            latitude=report.latitude,
            longitude=report.longitude,
            incident_type=report.report_type,
            description=report.description,
            severity=report.severity,
        )
        db.add(incident)
        await db.commit()
        logger.info(f"Incident created from report {report.id}")
    except Exception as e:
        logger.error(f"Failed to create incident from report: {e}")


@router.post("", response_model=ReportOut, status_code=201)
async def submit_report(
    body: ReportCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a crowdsourced safety report.
    High-severity reports (≥7) are auto-elevated to incidents in the background.
    """
    report = UserReport(
        id=uuid.uuid4(),
        latitude=body.latitude,
        longitude=body.longitude,
        report_type=body.report_type,
        severity=body.severity,
        description=body.description,
        anonymous=body.anonymous,
        user_id=body.user_id if not body.anonymous else None,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # High-severity reports → promote to incident in background
    if body.severity >= 7:
        background_tasks.add_task(_update_incident_from_report, db, report)

    logger.info(f"New report submitted: type={body.report_type} severity={body.severity}")
    return report


@router.get("", response_model=list[ReportOut])
async def list_reports(
    lat: float,
    lng: float,
    radius_m: int = 1000,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve recent user reports within a given radius.
    """
    try:
        result = await db.execute(
            text("""
                SELECT *
                FROM user_reports
                WHERE
                    ST_DWithin(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography,
                        :radius
                    )
                    AND created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 50
            """),
            {"lat": lat, "lng": lng, "radius": radius_m},
        )
        rows = result.fetchall()
        return [ReportOut(**dict(r._mapping)) for r in rows]
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch reports")
