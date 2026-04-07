"""
SafeStep Pydantic Schemas
Request/Response validation and serialization
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
import enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class RiskLevel(str, enum.Enum):
    SAFE = "SAFE"
    MODERATE = "MODERATE"
    RISKY = "RISKY"
    DANGER = "DANGER"


# ─── Analyze ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")
    radius_m: Optional[int] = Field(500, ge=50, le=5000, description="Search radius (meters)")

    model_config = {"json_schema_extra": {"example": {"lat": 40.7128, "lng": -74.0060, "radius_m": 500}}}


class NearbyIncident(BaseModel):
    id: UUID
    incident_type: str
    description: Optional[str]
    severity: int
    distance_m: float
    occurred_at: datetime

    model_config = {"from_attributes": True}


class AnalyzeResponse(BaseModel):
    lat: float
    lng: float
    safety_score: float = Field(..., ge=0, le=10, description="Safety index 0–10 (higher = safer)")
    color_code: str = Field(..., description="Hex color for map overlay")
    risk_level: RiskLevel
    status_message: str
    confidence: float = Field(..., ge=0, le=1, description="Model confidence 0–1")
    nearby_incidents: List[NearbyIncident] = []
    data_points_used: int = Field(..., description="Number of nearby data points used")


# ─── Safety Points ────────────────────────────────────────────────────────────

class SafetyPointCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    lighting_score: float = Field(..., ge=1, le=10)
    police_proximity_km: float = Field(..., ge=0)
    sentiment_score: float = Field(..., ge=1, le=10)
    crowd_density: float = Field(5.0, ge=1, le=10)
    incident_count_30d: int = Field(0, ge=0)
    source: str = "system"


class SafetyPointOut(SafetyPointCreate):
    id: UUID
    safety_index: Optional[float]
    risk_level: Optional[str]
    verified: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Routes ───────────────────────────────────────────────────────────────────

class RouteWaypoint(BaseModel):
    lat: float
    lng: float


class SafeRouteRequest(BaseModel):
    origin: RouteWaypoint
    destination: RouteWaypoint
    mode: str = Field("walking", pattern="^(walking|driving|cycling)$")


class RouteSegment(BaseModel):
    waypoints: List[RouteWaypoint]
    safety_score: float
    color_code: str
    distance_m: float


class SafeRouteResponse(BaseModel):
    overall_safety_score: float
    color_code: str
    risk_level: RiskLevel
    total_distance_m: float
    estimated_time_min: float
    segments: List[RouteSegment]
    safer_alternative: Optional[bool] = False


# ─── Reports ──────────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    report_type: str = Field(..., pattern="^(harassment|theft|assault|poor_lighting|suspicious_activity|other)$")
    severity: int = Field(..., ge=1, le=10)
    description: Optional[str] = Field(None, max_length=500)
    anonymous: bool = True
    user_id: Optional[str] = None


class ReportOut(ReportCreate):
    id: UUID
    verified: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── SOS ──────────────────────────────────────────────────────────────────────

class SOSRequest(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    message: Optional[str] = "SOS — I need help!"


class SOSResponse(BaseModel):
    triggered: bool
    contacts_notified: int
    nearest_police_station: Optional[str]
    nearest_police_distance_km: Optional[float]
    emergency_number: str = "911"
