"""
SafeStep — /sos router
SOS emergency alert endpoint
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging

from app.database import get_db
from app.schemas import SOSRequest, SOSResponse

router = APIRouter(prefix="/sos", tags=["sos"])
logger = logging.getLogger("safestep.sos")


@router.post("", response_model=SOSResponse)
async def trigger_sos(body: SOSRequest, db: AsyncSession = Depends(get_db)):
    """
    Trigger an SOS emergency alert.
    - Notifies registered emergency contacts
    - Returns nearest police station info
    """
    logger.critical(
        f"🚨 SOS TRIGGERED by user={body.user_id} "
        f"at ({body.latitude}, {body.longitude}): {body.message}"
    )

    # Look up emergency contacts for this user
    try:
        result = await db.execute(
            text("SELECT name, phone, email FROM emergency_contacts WHERE user_id = :uid LIMIT 5"),
            {"uid": body.user_id},
        )
        contacts = result.fetchall()
        contacts_notified = len(contacts)
    except Exception as e:
        logger.error(f"SOS contacts lookup failed: {e}")
        contacts = []
        contacts_notified = 0

    # In production, integrate with Twilio / SendGrid here to notify contacts
    # For now, we log and return simulated nearest station
    for contact in contacts:
        logger.info(f"  → Notifying {contact.name} at {contact.phone}")

    return SOSResponse(
        triggered=True,
        contacts_notified=contacts_notified,
        nearest_police_station="Central Police Station",
        nearest_police_distance_km=1.2,
        emergency_number="911",
    )
