"""
SafeStep — /analyze router
Core endpoint: accepts {lat, lng} and returns full safety analysis
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from typing import List
import logging

from app.database import get_db
from app.schemas import AnalyzeRequest, AnalyzeResponse, NearbyIncident
from app.models import SafetyPoint, Incident
from app.ai.safety_engine import safety_engine

router = APIRouter(prefix="/analyze", tags=["analyze"])
logger = logging.getLogger("safestep.analyze")


@router.post("", response_model=AnalyzeResponse)
async def analyze_location(body: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """
    Analyze safety for a given coordinate.

    - Queries nearby SafetyPoints within radius_m
    - Runs the AI engine (WLR + KNN) to compute Safety Index
    - Returns score, color, risk level, status, and nearby incidents
    """
    lat, lng, radius_m = body.lat, body.lng, body.radius_m

    # ── 1. Fetch nearby safety points (PostGIS spatial query) ────────────────
    try:
        nearby_result = await db.execute(
            text("""
                SELECT 
                    id::text,
                    latitude,
                    longitude,
                    lighting_score,
                    police_proximity_km,
                    sentiment_score,
                    crowd_density,
                    incident_count_30d,
                    safety_index,
                    ST_Distance(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography
                    ) AS distance_m
                FROM safety_points
                WHERE
                    ST_DWithin(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography,
                        :radius
                    )
                ORDER BY distance_m ASC
                LIMIT 20
            """),
            {"lat": lat, "lng": lng, "radius": radius_m},
        )
        nearby_points = [dict(row._mapping) for row in nearby_result]
    except Exception as e:
        logger.error(f"DB query error for nearby points: {e}")
        # Graceful fallback — no data
        nearby_points = []

    # ── 2. Fetch recent incidents nearby ─────────────────────────────────────
    try:
        incidents_result = await db.execute(
            text("""
                SELECT
                    id::text,
                    incident_type,
                    description,
                    severity,
                    occurred_at,
                    ST_Distance(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography
                    ) AS distance_m
                FROM incidents
                WHERE
                    ST_DWithin(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography,
                        :radius
                    )
                    AND occurred_at > NOW() - INTERVAL '30 days'
                ORDER BY occurred_at DESC
                LIMIT 10
            """),
            {"lat": lat, "lng": lng, "radius": radius_m},
        )
        incidents_raw = [dict(row._mapping) for row in incidents_result]
    except Exception as e:
        logger.error(f"DB query error for incidents: {e}")
        incidents_raw = []

    # ── 3. Run AI Safety Engine ───────────────────────────────────────────────
    safety_score, confidence, data_points_used = safety_engine.interpolate_for_location(
        lat, lng, nearby_points
    )

    risk_level, color_code, status_message = safety_engine.classify(safety_score)

    # ── 4. Format incident response ───────────────────────────────────────────
    nearby_incidents = [
        NearbyIncident(
            id=inc["id"],
            incident_type=inc["incident_type"],
            description=inc.get("description"),
            severity=inc["severity"],
            distance_m=round(inc["distance_m"], 1),
            occurred_at=inc["occurred_at"],
        )
        for inc in incidents_raw
    ]

    logger.info(
        f"Analyzed ({lat:.4f}, {lng:.4f}) → score={safety_score} "
        f"risk={risk_level} points_used={data_points_used}"
    )

    return AnalyzeResponse(
        lat=lat,
        lng=lng,
        safety_score=safety_score,
        color_code=color_code,
        risk_level=risk_level,
        status_message=status_message,
        confidence=confidence,
        nearby_incidents=nearby_incidents,
        data_points_used=data_points_used,
    )
