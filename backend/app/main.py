"""
SafeStep — FastAPI Main Application
Entry point: startup, middleware, router registration
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import os

from app.database import init_db, AsyncSessionLocal
from app.ai.safety_engine import safety_engine
from app.routers import analyze, reports, routes, sos

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("safestep")


# ─── Lifespan (Startup / Shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstrap DB and pre-train the AI model on startup."""
    logger.info("🚀 SafeStep backend starting up…")

    # Initialize DB tables + PostGIS
    await init_db()
    logger.info("✅ Database initialized (PostGIS enabled)")

    # Seed demo data if DB is empty, then train AI model
    await _seed_demo_data_if_empty()
    await _train_ai_model()

    logger.info("✅ AI Safety Engine ready")
    logger.info("🛡️  SafeStep is live!")
    yield

    logger.info("SafeStep shutting down…")


async def _seed_demo_data_if_empty():
    """Seed the database with realistic demo safety points for testing."""
    from app.models import SafetyPoint
    from sqlalchemy import func, select
    import uuid

    async with AsyncSessionLocal() as db:
        count_result = await db.execute(select(func.count()).select_from(SafetyPoint))
        count = count_result.scalar()

        if count > 0:
            logger.info(f"DB already has {count} safety points — skipping seed.")
            return

        logger.info("Seeding demo safety points…")

        # 20 synthetic points around NYC (40.71, -74.00)
        demo_points = [
            # Safe zones (downtown, well-lit, police nearby)
            dict(lat=40.7128, lng=-74.0060, lighting=9, police_km=0.3, sentiment=8, crowd=7, incidents=1),
            dict(lat=40.7580, lng=-73.9855, lighting=9, police_km=0.5, sentiment=8, crowd=8, incidents=0),
            dict(lat=40.7484, lng=-73.9856, lighting=8, police_km=0.8, sentiment=7, crowd=7, incidents=2),
            dict(lat=40.7614, lng=-73.9776, lighting=8, police_km=0.6, sentiment=8, crowd=6, incidents=1),
            dict(lat=40.7282, lng=-73.7949, lighting=7, police_km=1.0, sentiment=7, crowd=5, incidents=3),
            dict(lat=40.6892, lng=-74.0445, lighting=8, police_km=0.4, sentiment=7, crowd=6, incidents=2),
            dict(lat=40.7527, lng=-73.9772, lighting=9, police_km=0.3, sentiment=9, crowd=8, incidents=0),
            # Moderate zones
            dict(lat=40.7306, lng=-73.9352, lighting=5, police_km=2.0, sentiment=5, crowd=5, incidents=8),
            dict(lat=40.7081, lng=-74.0006, lighting=6, police_km=1.5, sentiment=6, crowd=5, incidents=5),
            dict(lat=40.6782, lng=-73.9442, lighting=5, police_km=2.2, sentiment=5, crowd=4, incidents=10),
            dict(lat=40.7359, lng=-73.9911, lighting=6, police_km=1.8, sentiment=6, crowd=5, incidents=6),
            dict(lat=40.7489, lng=-73.9680, lighting=5, police_km=2.5, sentiment=5, crowd=4, incidents=9),
            # Risky zones
            dict(lat=40.6654, lng=-73.9444, lighting=3, police_km=4.0, sentiment=3, crowd=3, incidents=25),
            dict(lat=40.6742, lng=-73.9441, lighting=2, police_km=5.0, sentiment=2, crowd=2, incidents=35),
            dict(lat=40.6588, lng=-73.9563, lighting=3, police_km=3.5, sentiment=3, crowd=3, incidents=20),
            dict(lat=40.7020, lng=-74.0150, lighting=2, police_km=4.5, sentiment=2, crowd=2, incidents=30),
            # Danger zones
            dict(lat=40.6501, lng=-73.9496, lighting=1, police_km=7.0, sentiment=1, crowd=1, incidents=50),
            dict(lat=40.6420, lng=-73.9720, lighting=1, police_km=8.0, sentiment=1, crowd=1, incidents=48),
            dict(lat=40.6350, lng=-73.9510, lighting=2, police_km=6.5, sentiment=2, crowd=2, incidents=42),
            dict(lat=40.6600, lng=-73.9100, lighting=1, police_km=7.5, sentiment=1, crowd=1, incidents=45),
        ]

        from app.ai.safety_engine import extract_features, compute_weighted_score
        import numpy as np

        points = []
        for p in demo_points:
            feat = extract_features({
                "lighting_score": p["lighting"],
                "police_proximity_km": p["police_km"],
                "sentiment_score": p["sentiment"],
                "crowd_density": p["crowd"],
                "incident_count_30d": p["incidents"],
            })
            score = compute_weighted_score(feat)
            risk = (
                "SAFE" if score >= 7.5
                else "MODERATE" if score >= 5.0
                else "RISKY" if score >= 2.5
                else "DANGER"
            )
            points.append(SafetyPoint(
                id=uuid.uuid4(),
                latitude=p["lat"],
                longitude=p["lng"],
                lighting_score=p["lighting"],
                police_proximity_km=p["police_km"],
                sentiment_score=p["sentiment"],
                crowd_density=p["crowd"],
                incident_count_30d=p["incidents"],
                safety_index=score,
                risk_level=risk,
                source="seed",
                verified=True,
            ))

        db.add_all(points)
        await db.commit()
        logger.info(f"✅ Seeded {len(points)} demo safety points.")


async def _train_ai_model():
    """Load all safety points from DB and train the KNN model."""
    from app.models import SafetyPoint
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SafetyPoint))
        points = result.scalars().all()
        point_dicts = [
            {
                "latitude": p.latitude,
                "longitude": p.longitude,
                "lighting_score": p.lighting_score,
                "police_proximity_km": p.police_proximity_km,
                "sentiment_score": p.sentiment_score,
                "crowd_density": p.crowd_density,
                "incident_count_30d": p.incident_count_30d,
                "safety_index": p.safety_index,
            }
            for p in points
        ]
        safety_engine.retrain(point_dicts)
        logger.info(f"KNN model trained on {len(point_dicts)} points.")


# ─── App Instance ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="SafeStep API",
    description="AI-Powered Personal Safety Navigation Backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(analyze.router)
app.include_router(reports.router)
app.include_router(routes.router)
app.include_router(sos.router)


# ─── Root & Health ────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
async def root():
    return {
        "app": "SafeStep",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health():
    return {
        "status": "healthy",
        "ai_model_trained": safety_engine.knn_model.is_trained,
        "training_points": safety_engine.knn_model.training_size,
    }
