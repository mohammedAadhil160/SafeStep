"""
SafeStep Database Models
PostgreSQL + PostGIS spatial models via SQLAlchemy
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Text, DateTime,
    Boolean, Enum as SAEnum, func
)
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum
from app.database import Base


class RiskLevel(enum.Enum):
    SAFE = "SAFE"
    MODERATE = "MODERATE"
    RISKY = "RISKY"
    DANGER = "DANGER"


class SafetyPoint(Base):
    """
    Core table: each row is a geo-tagged safety data record.
    lat/lng stored as standard floats; PostGIS geometry computed via trigger.
    """
    __tablename__ = "safety_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)

    # Feature scores (1–10 unless noted)
    lighting_score = Column(Float, nullable=False, default=5.0)        # Street lighting quality
    police_proximity_km = Column(Float, nullable=False, default=2.0)   # Distance to nearest police station
    sentiment_score = Column(Float, nullable=False, default=5.0)       # News/tweet sentiment (1–10)
    crowd_density = Column(Float, nullable=False, default=5.0)         # People density (1–10)
    incident_count_30d = Column(Integer, nullable=False, default=0)    # Incidents last 30 days

    # Computed by AI engine
    safety_index = Column(Float, nullable=True)                        # Final score 0.0–10.0
    risk_level = Column(SAEnum(RiskLevel), nullable=True)

    # Metadata
    source = Column(String(50), default="system")                      # system | crowdsource | api
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SafetyPoint lat={self.latitude:.4f} lng={self.longitude:.4f} idx={self.safety_index}>"


class UserReport(Base):
    """
    Crowdsourced user safety reports.
    """
    __tablename__ = "user_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    report_type = Column(String(50), nullable=False)   # harassment | theft | assault | poor_lighting | other
    severity = Column(Integer, nullable=False, default=5)  # 1–10
    description = Column(Text, nullable=True)
    anonymous = Column(Boolean, default=True)
    user_id = Column(String(100), nullable=True)       # Optional user identifier

    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<UserReport type={self.report_type} severity={self.severity}>"


class Incident(Base):
    """
    Processed incidents (from reports or external APIs).
    Used in /analyze nearby_incidents response.
    """
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    incident_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Integer, nullable=False, default=5)  # 1–10
    distance_m = Column(Float, nullable=True)              # Populated at query time

    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Incident type={self.incident_type} at ({self.latitude},{self.longitude})>"


class EmergencyContact(Base):
    """
    User SOS emergency contacts.
    """
    __tablename__ = "emergency_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(200), nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
