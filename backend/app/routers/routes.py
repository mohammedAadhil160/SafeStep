"""
SafeStep — /routes router
Safe route calculation between two coordinates
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging
import math

from app.database import get_db
from app.schemas import SafeRouteRequest, SafeRouteResponse, RouteSegment, RouteWaypoint
from app.ai.safety_engine import safety_engine, haversine_distance

router = APIRouter(prefix="/routes", tags=["routes"])
logger = logging.getLogger("safestep.routes")

# Speed constants (m/min)
SPEED = {"walking": 83, "cycling": 250, "driving": 500}

COLOR_MAP = {
    "SAFE":     "#00E676",
    "MODERATE": "#FFEA00",
    "RISKY":    "#FF6D00",
    "DANGER":   "#D50000",
}


def _interpolate_waypoints(origin: RouteWaypoint, dest: RouteWaypoint, n: int = 5):
    """Generate n evenly spaced waypoints between origin and destination."""
    waypoints = []
    for i in range(n + 1):
        t = i / n
        waypoints.append(RouteWaypoint(
            lat=origin.lat + t * (dest.lat - origin.lat),
            lng=origin.lng + t * (dest.lng - origin.lng),
        ))
    return waypoints


@router.post("/safe", response_model=SafeRouteResponse, tags=["routes"])
async def get_safe_route(body: SafeRouteRequest, db: AsyncSession = Depends(get_db)):
    """
    Calculate a safe route between two coordinates.
    Segments the route and scores each segment using the AI engine.
    """
    origin, dest = body.origin, body.destination
    mode = body.mode
    speed_mpm = SPEED.get(mode, 83)

    # Interpolate 6 segment waypoints
    waypoints = _interpolate_waypoints(origin, dest, n=6)
    total_distance_m = haversine_distance(origin.lat, origin.lng, dest.lat, dest.lng)

    segments = []
    score_sum = 0.0

    for i in range(len(waypoints) - 1):
        wp = waypoints[i]
        wp_next = waypoints[i + 1]
        seg_dist = haversine_distance(wp.lat, wp.lng, wp_next.lat, wp_next.lng)

        # Query nearby safety data for segment midpoint
        mid_lat = (wp.lat + wp_next.lat) / 2
        mid_lng = (wp.lng + wp_next.lng) / 2

        try:
            result = await db.execute(
                text("""
                    SELECT latitude, longitude, lighting_score,
                           police_proximity_km, sentiment_score,
                           crowd_density, incident_count_30d, safety_index
                    FROM safety_points
                    WHERE ST_DWithin(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography,
                        500
                    )
                    ORDER BY ST_Distance(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint(:lng, :lat)::geography
                    )
                    LIMIT 5
                """),
                {"lat": mid_lat, "lng": mid_lng},
            )
            nearby = [dict(r._mapping) for r in result.fetchall()]
        except Exception:
            nearby = []

        seg_score, _, _ = safety_engine.interpolate_for_location(mid_lat, mid_lng, nearby)
        risk_level, color, _ = safety_engine.classify(seg_score)
        score_sum += seg_score

        segments.append(RouteSegment(
            waypoints=[wp, wp_next],
            safety_score=seg_score,
            color_code=color,
            distance_m=round(seg_dist, 1),
        ))

    avg_score = round(score_sum / len(segments), 2) if segments else 5.0
    risk_level, color_code, _ = safety_engine.classify(avg_score)
    est_time_min = round(total_distance_m / speed_mpm, 1)

    return SafeRouteResponse(
        overall_safety_score=avg_score,
        color_code=color_code,
        risk_level=risk_level,
        total_distance_m=round(total_distance_m, 1),
        estimated_time_min=est_time_min,
        segments=segments,
        safer_alternative=avg_score < 5.0,
    )
