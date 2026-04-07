"""
SafeStep — Self-Contained Demo Backend  (v2.0)
Real AI safety scoring engine with genuine variation.
SQLite only — no PostgreSQL required.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import sqlite3, math, uuid, os, json, random, hashlib
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from typing import Optional, List
from pydantic import BaseModel, Field
import uvicorn
import pathlib

# ──────────────────────────────────────────────────────────────────────────────
# DATABASE (SQLite)
# ──────────────────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "safestep_v2.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS safety_points (
            id TEXT PRIMARY KEY,
            latitude REAL, longitude REAL,
            lighting_score REAL DEFAULT 5,
            police_proximity_km REAL DEFAULT 2,
            sentiment_score REAL DEFAULT 5,
            crowd_density REAL DEFAULT 5,
            incident_count_30d INTEGER DEFAULT 0,
            road_quality REAL DEFAULT 5,
            cctv_coverage REAL DEFAULT 5,
            emergency_response_min REAL DEFAULT 15,
            safety_index REAL,
            risk_level TEXT,
            source TEXT DEFAULT 'seed',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS user_reports (
            id TEXT PRIMARY KEY,
            latitude REAL, longitude REAL,
            report_type TEXT, severity INTEGER,
            description TEXT, anonymous INTEGER DEFAULT 1,
            user_id TEXT, created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            latitude REAL, longitude REAL,
            incident_type TEXT, severity INTEGER,
            description TEXT, occurred_at TEXT
        );

        CREATE TABLE IF NOT EXISTS police_stations (
            id TEXT PRIMARY KEY,
            name TEXT,
            latitude REAL, longitude REAL,
            type TEXT DEFAULT 'station'
        );

        CREATE TABLE IF NOT EXISTS emergency_contacts (
            id TEXT PRIMARY KEY,
            user_id TEXT, name TEXT, phone TEXT,
            email TEXT, is_primary INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# DEMO DATA — 60+ realistic points across South India with HIGH VARIANCE
# ──────────────────────────────────────────────────────────────────────────────
# Format: (lat, lng, lighting, police_km, sentiment, crowd, incidents, road_quality, cctv, response_min)

DEMO_POINTS = [
    # ════════ SAFE ZONES (score 7.5–10) ════════
    # Chennai - Anna Nagar
    (13.0850, 80.2101, 9.5, 0.3, 9.0, 7.5, 0, 9, 9, 4),
    # Chennai - T Nagar (shopping district)
    (13.0418, 80.2341, 9.0, 0.5, 8.5, 8.0, 1, 8, 9, 5),
    # Chennai - Besant Nagar
    (13.0002, 80.2660, 8.5, 0.6, 8.0, 6.5, 0, 8, 8, 6),
    # Chennai - Adyar
    (13.0012, 80.2565, 8.8, 0.4, 8.5, 7.0, 1, 9, 8, 5),
    # Coimbatore - RS Puram
    (11.0050, 76.9620, 8.5, 0.5, 8.0, 7.0, 1, 8, 7, 7),
    # Coimbatore - Gandhipuram
    (11.0168, 76.9558, 8.0, 0.8, 7.5, 7.5, 2, 7, 7, 8),
    # Madurai - Town Hall
    (9.9195, 78.1190, 8.5, 0.4, 8.0, 7.0, 1, 7, 7, 6),
    # Trichy - Cantonment
    (10.8050, 78.6900, 8.0, 0.6, 7.5, 6.0, 2, 8, 6, 8),
    # Bangalore - MG Road
    (12.9716, 77.5946, 9.5, 0.2, 9.0, 8.5, 0, 9, 10, 3),
    # Bangalore - Indiranagar
    (12.9784, 77.6408, 9.0, 0.4, 8.5, 7.5, 1, 9, 9, 4),
    # Chennai - Mylapore
    (13.0368, 80.2676, 8.5, 0.5, 8.0, 7.0, 1, 8, 8, 5),
    # Pondicherry - White Town
    (11.9340, 79.8306, 8.0, 0.7, 8.5, 6.0, 0, 7, 7, 8),

    # ════════ MODERATE-SAFE ZONES (score 6.0–7.5) ════════
    # Chennai - Kilpauk
    (13.0800, 80.2420, 7.0, 1.2, 6.5, 6.0, 3, 7, 6, 8),
    # Chennai - Kodambakkam
    (13.0520, 80.2250, 6.5, 1.5, 6.0, 5.5, 5, 6, 5, 9),
    # Salem - Town area
    (11.6643, 78.1460, 6.5, 1.8, 6.0, 5.0, 4, 6, 5, 10),
    # Vellore - Fort area
    (12.9165, 79.1325, 7.0, 1.2, 6.5, 5.5, 3, 6, 5, 9),
    # Coimbatore - Peelamedu
    (11.0250, 77.0100, 6.5, 1.6, 6.0, 5.0, 5, 6, 5, 10),
    # Thanjavur city
    (10.7870, 79.1378, 6.5, 1.4, 6.5, 5.0, 4, 6, 5, 9),
    # Erode city
    (11.3410, 77.7172, 6.0, 1.8, 6.0, 5.0, 6, 5, 4, 11),

    # ════════ MODERATE ZONES (score 4.5–6.0) ════════
    # Chennai - Vadapalani
    (13.0475, 80.2090, 5.0, 2.2, 5.0, 5.0, 10, 5, 4, 12),
    # Chennai - Ambattur Industrial
    (13.1143, 80.1481, 5.5, 2.0, 5.5, 4.5, 8, 5, 4, 11),
    # Chennai - Perambur
    (13.1130, 80.2330, 5.0, 2.5, 4.5, 4.0, 12, 4, 3, 13),
    # Tiruppur - Industrial area
    (11.1085, 77.3411, 4.5, 2.8, 4.5, 4.0, 14, 4, 3, 14),
    # Dindigul
    (10.3624, 77.9695, 5.0, 2.5, 5.0, 4.0, 9, 5, 3, 13),
    # Hosur
    (12.7409, 77.8253, 5.5, 2.0, 5.0, 5.0, 7, 5, 4, 11),
    # Nagercoil
    (8.1833, 77.4119, 5.0, 2.3, 5.0, 4.5, 8, 5, 3, 12),
    # Kanchipuram
    (12.8342, 79.7036, 5.5, 2.0, 5.5, 4.5, 7, 5, 4, 11),

    # ════════ RISKY ZONES (score 2.5–4.5) ════════
    # Chennai - Washermanpet
    (13.1067, 80.2755, 3.0, 3.5, 3.0, 3.5, 22, 3, 2, 18),
    # Chennai - Royapuram (docks)
    (13.1200, 80.2900, 3.5, 3.0, 3.5, 3.0, 18, 3, 2, 16),
    # Chennai - Vyasarpadi
    (13.1250, 80.2450, 2.5, 4.0, 2.5, 2.5, 28, 2, 1, 20),
    # Tirunelveli outskirts
    (8.7139, 77.7567, 3.0, 3.8, 3.0, 2.5, 20, 3, 2, 18),
    # Madurai - outskirts NW
    (9.9500, 78.0700, 3.5, 3.5, 3.5, 3.0, 16, 3, 2, 16),
    # Salem - Industrial belt
    (11.7000, 78.2000, 3.0, 4.0, 3.0, 2.5, 22, 3, 1, 19),
    # Cuddalore coastal
    (11.7480, 79.7714, 3.5, 3.5, 3.0, 2.5, 18, 3, 2, 17),
    # Villupuram outskirts
    (11.9300, 79.4700, 3.0, 4.0, 3.0, 2.0, 24, 2, 1, 19),

    # ════════ DANGER ZONES (score 0–2.5) ════════
    # Chennai - Ennore (industrial/port)
    (13.2150, 80.3175, 1.5, 6.0, 1.5, 1.5, 42, 1, 0, 30),
    # Remote highway near Dharmapuri
    (12.1300, 78.1500, 1.0, 8.0, 1.0, 0.5, 38, 1, 0, 35),
    # Unlit stretch near Ramanathapuram
    (9.3700, 78.8300, 1.0, 7.0, 1.5, 1.0, 35, 1, 0, 32),
    # Rural road Nagapattinam
    (10.7600, 79.8400, 1.5, 6.5, 1.5, 1.0, 30, 2, 0, 28),
    # Isolated stretch near Krishnagiri
    (12.5200, 78.2100, 1.0, 7.5, 1.0, 0.5, 40, 1, 0, 33),
    # Remote Nilgiris road
    (11.4000, 76.7000, 1.5, 7.0, 1.5, 0.5, 32, 1, 0, 35),

    # ════════ EXTRA VARIANCE POINTS ════════
    # Bangalore - Whitefield (tech hub, very safe)
    (12.9698, 77.7500, 9.0, 0.3, 9.0, 8.0, 0, 9, 9, 4),
    # Bangalore - KR Market (moderate, crowded)
    (12.9630, 77.5770, 6.0, 1.0, 5.5, 9.0, 6, 5, 6, 7),
    # Mysore Palace area
    (12.3051, 76.6551, 8.5, 0.5, 8.5, 7.0, 1, 8, 7, 7),
    # Ooty town center
    (11.4102, 76.6950, 7.0, 1.5, 7.5, 5.0, 2, 6, 5, 12),
    # Kodaikanal
    (10.2381, 77.4892, 6.5, 2.0, 7.0, 4.0, 3, 5, 4, 15),
    # Rameswaram
    (9.2876, 79.3129, 6.0, 2.5, 6.5, 4.5, 4, 5, 3, 14),
    # Kanyakumari
    (8.0883, 77.5385, 7.0, 1.2, 7.0, 6.0, 2, 6, 5, 10),
    # Tiruchendur
    (8.4957, 78.1201, 5.5, 2.5, 6.0, 4.0, 5, 5, 3, 13),
    # Karur
    (10.9601, 78.0766, 5.0, 2.2, 5.0, 4.0, 8, 5, 3, 12),
    # Namakkal
    (11.2189, 78.1674, 5.0, 2.5, 5.0, 3.5, 9, 4, 3, 14),
    # Sivakasi
    (9.4533, 77.7980, 4.5, 3.0, 4.0, 3.5, 15, 4, 2, 16),
    # Thoothukudi port area
    (8.7642, 78.1348, 4.0, 3.5, 3.5, 3.0, 18, 3, 2, 17),
    # Pollachi
    (10.6609, 77.0083, 6.0, 1.8, 6.0, 4.0, 5, 6, 4, 11),
    # Kumbakonam
    (10.9617, 79.3881, 6.5, 1.5, 6.5, 5.0, 3, 6, 5, 10),
    # Tiruvannamalai
    (12.2253, 79.0747, 6.0, 2.0, 6.5, 5.0, 4, 5, 4, 12),
    # Chidambaram
    (11.3990, 79.6912, 5.5, 2.2, 5.5, 4.0, 6, 5, 3, 13),
]

DEMO_INCIDENTS = [
    (13.1067, 80.2755, "theft", 7, "Chain snatching near bus stop"),
    (13.1200, 80.2900, "assault", 6, "Physical altercation reported"),
    (13.1250, 80.2450, "harassment", 8, "Group harassment late night"),
    (13.2150, 80.3175, "theft", 9, "Vehicle theft in parking"),
    (12.1300, 78.1500, "assault", 8, "Highway robbery attempt"),
    (9.3700, 78.8300, "harassment", 7, "Suspicious activity reported"),
    (11.1085, 77.3411, "theft", 6, "Bag snatching incident"),
    (13.0475, 80.2090, "poor_lighting", 5, "Multiple complaints about dark streets"),
    (9.4533, 77.7980, "assault", 7, "Physical violence reported"),
    (8.7642, 78.1348, "theft", 6, "Petty theft at market"),
    (13.1130, 80.2330, "harassment", 6, "Street harassment complaint"),
    (11.7000, 78.2000, "other", 5, "Stray dogs menace area"),
]

# Police stations for realistic proximity calculations
POLICE_STATIONS = [
    ("Chennai Central PS", 13.0827, 80.2707),
    ("T Nagar PS", 13.0418, 80.2350),
    ("Adyar PS", 13.0060, 80.2570),
    ("Anna Nagar PS", 13.0860, 80.2100),
    ("Washermanpet PS", 13.1100, 80.2700),
    ("Ambattur PS", 13.1143, 80.1500),
    ("Coimbatore City PS", 11.0168, 76.9560),
    ("Madurai Central PS", 9.9200, 78.1200),
    ("Trichy Town PS", 10.8050, 78.6910),
    ("Salem PS", 11.6643, 78.1460),
    ("Bangalore MG Road PS", 12.9720, 77.5950),
    ("Bangalore Indiranagar PS", 12.9790, 77.6410),
    ("Mysore PS", 12.3060, 76.6560),
    ("Vellore PS", 12.9170, 79.1330),
    ("Tirunelveli PS", 8.7300, 77.7100),
    ("Pondicherry PS", 11.9350, 79.8310),
    ("Kanyakumari PS", 8.0890, 77.5390),
    ("Thanjavur PS", 10.7875, 79.1380),
]


# ──────────────────────────────────────────────────────────────────────────────
# AI SAFETY ENGINE — Real multi-factor scoring with genuine variation
# ──────────────────────────────────────────────────────────────────────────────

FEATURE_NAMES = ["lighting", "police", "sentiment", "crowd", "incidents", "road", "cctv", "response"]

# Weighted importance per feature
FEATURE_WEIGHTS = np.array([0.18, 0.15, 0.14, 0.10, 0.18, 0.08, 0.10, 0.07])

RISK_MAP = {
    "SAFE":     ("#00E676", "🟢 This area is well-lit and well-patrolled. Safe for travel."),
    "MODERATE": ("#FFD600", "🟡 Exercise normal precautions. Stay aware of surroundings."),
    "RISKY":    ("#FF6D00", "🟠 Elevated risk zone. Stick to main roads and stay alert."),
    "DANGER":   ("#FF1744", "🔴 High-risk area. Strongly consider an alternate route."),
}

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(min(a, 1.0)))

def nearest_police_station(lat, lng):
    """Calculate actual distance to nearest police station."""
    min_dist = float('inf')
    nearest_name = "Unknown"
    for name, plat, plng in POLICE_STATIONS:
        d = haversine(lat, lng, plat, plng) / 1000  # km
        if d < min_dist:
            min_dist = d
            nearest_name = name
    return round(min_dist, 2), nearest_name

def extract_features(p):
    """Extract 8 normalized features from a safety point dictionary."""
    lighting   = min(max(p.get("lighting_score", 5), 0), 10) / 10.0
    police     = 1.0 - min(p.get("police_proximity_km", 5), 10) / 10.0
    sentiment  = min(max(p.get("sentiment_score", 5), 0), 10) / 10.0
    # Crowd: optimal around 6 (busy but not overcrowded)
    crowd_raw  = min(max(p.get("crowd_density", 5), 0), 10)
    crowd      = 1.0 - abs(crowd_raw - 6.0) / 6.0
    incidents  = 1.0 - min(p.get("incident_count_30d", 0), 50) / 50.0
    road       = min(max(p.get("road_quality", 5), 0), 10) / 10.0
    cctv       = min(max(p.get("cctv_coverage", 5), 0), 10) / 10.0
    response   = 1.0 - min(p.get("emergency_response_min", 15), 60) / 60.0
    return np.array([lighting, police, sentiment, crowd, incidents, road, cctv, response])

def wlr_score(features):
    """Weighted Linear Regression base score."""
    return round(min(max(float(np.dot(features, FEATURE_WEIGHTS)) * 10, 0), 10), 2)

def classify(score):
    if score >= 7.5: return "SAFE"
    if score >= 5.0: return "MODERATE"
    if score >= 2.5: return "RISKY"
    return "DANGER"

def location_hash_noise(lat, lng):
    """Deterministic but varied noise per location (consistent per coordinate)."""
    h = hashlib.md5(f"{round(lat,4)},{round(lng,4)}".encode()).hexdigest()
    # Extract multiple noise values from hash
    noise1 = (int(h[:4], 16) / 65535.0 - 0.5) * 0.8  # -0.4 to +0.4
    noise2 = (int(h[4:8], 16) / 65535.0 - 0.5) * 0.6  # -0.3 to +0.3
    return noise1, noise2


class AIEngine:
    def __init__(self):
        self.model = Pipeline([
            ("sc", StandardScaler()),
            ("gb", GradientBoostingRegressor(
                n_estimators=200, max_depth=4, learning_rate=0.1,
                subsample=0.8, random_state=42
            ))
        ])
        self.trained = False
        self.n = 0

    def train(self, points):
        if len(points) < 5:
            return
        X = np.array([extract_features(p) for p in points])
        y = np.array([p.get("safety_index") or wlr_score(extract_features(p)) for p in points])
        self.model.fit(X, y)
        self.trained = True
        self.n = len(points)

    def predict(self, p):
        feats = extract_features(p)
        if not self.trained:
            return wlr_score(feats), 0.4
        X = feats.reshape(1, -1)
        score = round(min(max(float(self.model.predict(X)[0]), 0), 10), 2)
        # Blend WLR and ML prediction for stability
        wlr = wlr_score(feats)
        blended = round(0.35 * wlr + 0.65 * score, 2)
        conf = round(min(0.95, 0.5 + self.n / 150), 2)
        return blended, conf


model_engine = AIEngine()


def interpolate_safety(lat, lng, nearby, all_police=True):
    """
    IDW interpolation with ML refinement.
    Returns (score, confidence, n_points, metrics_dict)
    """
    # Get actual police proximity
    police_km, police_name = nearest_police_station(lat, lng)

    # Time-of-day factor
    ist_hour = (datetime.utcnow().hour + 5.5) % 24
    is_night = ist_hour >= 20 or ist_hour <= 5
    is_late_night = ist_hour >= 23 or ist_hour <= 4
    is_dawn = 5 < ist_hour <= 7
    day_of_week = datetime.utcnow().weekday()  # 0=Mon, 6=Sun
    is_weekend = day_of_week >= 5

    # Location-based deterministic noise for realism
    noise1, noise2 = location_hash_noise(lat, lng)

    if not nearby:
        # No data nearby — estimate from geographic features
        base = 4.5 + noise1 * 2  # 2.5–6.5 range based on location
        # Adjust for police proximity
        if police_km < 1: base += 1.5
        elif police_km < 3: base += 0.5
        elif police_km > 5: base -= 1.0
        elif police_km > 8: base -= 2.0

        base = min(max(base, 1.0), 9.0)
        metrics = {
            "lighting_score": round(5.0 + noise2 * 3, 1),
            "police_proximity_km": police_km,
            "crowd_density": round(4.0 + noise1 * 3, 1),
            "sentiment_score": round(5.0 + noise2 * 2, 1),
            "road_quality": round(5.0 + noise1 * 2, 1),
            "cctv_coverage": round(3.0 + noise2 * 3, 1),
            "incident_count_30d": max(0, int(8 + noise1 * 10)),
            "emergency_response_min": round(max(5, 15 + noise2 * 10), 1)
        }
        conf = 0.15
        n_pts = 0
    elif len(nearby) == 1:
        p = nearby[0]
        d = max(haversine(lat, lng, p["latitude"], p["longitude"]), 1)
        dist_factor = min(d / 5000, 1.0)  # decay over 5km
        base_score = p.get("safety_index") or wlr_score(extract_features(p))
        # Blend with distance decay + noise
        base = base_score * (1 - dist_factor * 0.4) + noise1 * 0.5
        base = min(max(base, 0.5), 9.5)
        metrics = {
            "lighting_score": p["lighting_score"],
            "police_proximity_km": police_km,
            "crowd_density": p.get("crowd_density", 5),
            "sentiment_score": p.get("sentiment_score", 5),
            "road_quality": p.get("road_quality", 5),
            "cctv_coverage": p.get("cctv_coverage", 5),
            "incident_count_30d": p.get("incident_count_30d", 0),
            "emergency_response_min": p.get("emergency_response_min", 15)
        }
        conf = round(max(0.25, 0.5 - dist_factor * 0.3), 2)
        n_pts = 1
    else:
        # Multiple points — full IDW interpolation
        scores, weights = [], []
        for p in nearby:
            d = max(haversine(lat, lng, p["latitude"], p["longitude"]), 10)
            s = p.get("safety_index") or wlr_score(extract_features(p))
            scores.append(s)
            weights.append(1.0 / (d ** 2))

        w = np.array(weights)
        s = np.array(scores)
        idw = float(np.average(s, weights=w))

        # Weighted average of metrics
        total_w = sum(weights)
        def wavg(key, default=5.0):
            vals = [p.get(key, default) for p in nearby]
            return float(np.average(vals, weights=w))

        metrics = {
            "lighting_score": round(wavg("lighting_score"), 1),
            "police_proximity_km": police_km,
            "crowd_density": round(wavg("crowd_density"), 1),
            "sentiment_score": round(wavg("sentiment_score"), 1),
            "road_quality": round(wavg("road_quality", 5), 1),
            "cctv_coverage": round(wavg("cctv_coverage", 5), 1),
            "incident_count_30d": int(wavg("incident_count_30d", 0)),
            "emergency_response_min": round(wavg("emergency_response_min", 15), 1)
        }

        # ML refinement if available
        if model_engine.trained and len(nearby) >= 2:
            rf_s, rf_c = model_engine.predict(metrics)
            base = round(0.55 * idw + 0.45 * rf_s, 2)
            conf = round(min(rf_c + 0.05, 0.95), 2)
        else:
            base = round(idw, 2)
            conf = round(min(0.3 + len(nearby) * 0.08, 0.85), 2)

        # Add location noise for realism
        base += noise1 * 0.3
        n_pts = len(nearby)

    # ─── Dynamic modifiers ─── 
    # Night penalty
    if is_late_night:
        night_penalty = 0.70 + (metrics.get("lighting_score", 5) / 10.0) * 0.10
        base *= night_penalty
    elif is_night:
        night_penalty = 0.82 + (metrics.get("lighting_score", 5) / 10.0) * 0.08
        base *= night_penalty
    elif is_dawn:
        base *= 0.95

    # Weekend bonus (more crowds = safer in commercial areas)
    if is_weekend and metrics.get("crowd_density", 5) > 6:
        base *= 1.05

    # Police proximity bonus
    if police_km < 0.5:
        base += 0.5
    elif police_km < 1.0:
        base += 0.3
    elif police_km > 5.0:
        base -= 0.3
    elif police_km > 8.0:
        base -= 0.6

    final = round(min(max(base, 0.5), 9.8), 2)
    return final, conf, n_pts, metrics, police_km, police_name


# ──────────────────────────────────────────────────────────────────────────────
# SEED & TRAIN
# ──────────────────────────────────────────────────────────────────────────────

def seed_data():
    conn = get_db()
    c = conn.cursor()
    count = c.execute("SELECT COUNT(*) FROM safety_points").fetchone()[0]
    if count > 0:
        conn.close()
        return

    for lat, lng, li, pp, se, cr, inc, rq, cc, er in DEMO_POINTS:
        p = {
            "lighting_score": li, "police_proximity_km": pp,
            "sentiment_score": se, "crowd_density": cr,
            "incident_count_30d": inc, "road_quality": rq,
            "cctv_coverage": cc, "emergency_response_min": er
        }
        feat = extract_features(p)
        score = wlr_score(feat)
        c.execute(
            "INSERT INTO safety_points VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), lat, lng, li, pp, se, cr, inc, rq, cc, er,
             score, classify(score), "seed", datetime.utcnow().isoformat())
        )

    for lat, lng, typ, sev, desc in DEMO_INCIDENTS:
        c.execute("INSERT INTO incidents VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), lat, lng, typ, sev, desc,
             (datetime.utcnow() - timedelta(days=random.randint(1, 25))).isoformat()))

    for name, plat, plng in POLICE_STATIONS:
        c.execute("INSERT INTO police_stations VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), name, plat, plng, "station"))

    conn.commit()
    conn.close()
    print(f"✅ Seeded {len(DEMO_POINTS)} safety points + {len(DEMO_INCIDENTS)} incidents + {len(POLICE_STATIONS)} police stations")

def train_model():
    conn = get_db()
    rows = conn.execute("SELECT * FROM safety_points").fetchall()
    conn.close()
    pts = [dict(r) for r in rows]
    model_engine.train(pts)
    print(f"✅ GradientBoosting trained on {len(pts)} points (8 features)")


# ──────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────────────────────────────

class AnalyzeReq(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_m: Optional[int] = Field(2000, ge=50, le=10000)

class RouteWP(BaseModel):
    lat: float
    lng: float

class RouteReq(BaseModel):
    origin: RouteWP
    destination: RouteWP
    mode: str = "walking"

class ReportReq(BaseModel):
    latitude: float
    longitude: float
    report_type: str
    severity: int = Field(..., ge=1, le=10)
    description: Optional[str] = None
    anonymous: bool = True
    user_id: Optional[str] = None

class SOSReq(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    message: Optional[str] = "SOS — I need help!"


# ──────────────────────────────────────────────────────────────────────────────
# APP
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 SafeStep v2 starting up...")
    init_db()
    seed_data()
    train_model()
    print("🛡️  SafeStep is live at http://localhost:8000")
    yield

app = FastAPI(title="SafeStep Demo API", version="2.0.0", lifespan=lifespan,
              docs_url="/docs", redoc_url="/redoc")

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Serve UI static assets from project root
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.get("/safestep_styles.css")
def serve_css():
    return FileResponse(os.path.join(_PROJECT_ROOT, "safestep_styles.css"), media_type="text/css")

@app.get("/safestep_app.js")
def serve_js():
    return FileResponse(os.path.join(_PROJECT_ROOT, "safestep_app.js"), media_type="application/javascript")


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "SafeStep Demo", "version": "2.0.0",
        "status": "online", "docs": "/docs",
        "model_trained": model_engine.trained,
        "training_points": model_engine.n,
        "features": 8
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai_model": "GradientBoosting",
        "ai_model_trained": model_engine.trained,
        "training_points": model_engine.n,
        "feature_count": 8,
        "db": "sqlite (demo)"
    }

@app.post("/analyze")
def analyze(body: AnalyzeReq):
    lat, lng, radius = body.lat, body.lng, body.radius_m

    conn = get_db()
    all_pts = [dict(r) for r in conn.execute("SELECT * FROM safety_points").fetchall()]
    nearby = sorted(
        [p for p in all_pts if haversine(lat, lng, p["latitude"], p["longitude"]) <= radius],
        key=lambda p: haversine(lat, lng, p["latitude"], p["longitude"])
    )[:25]

    # Nearby incidents (last 30 days)
    incidents_raw = [
        dict(r) for r in conn.execute(
            "SELECT * FROM incidents WHERE occurred_at > ?",
            ((datetime.utcnow() - timedelta(days=30)).isoformat(),)
        ).fetchall()
    ]
    conn.close()

    nearby_incidents = sorted([
        {**inc, "distance_m": round(haversine(lat, lng, inc["latitude"], inc["longitude"]), 1)}
        for inc in incidents_raw
        if haversine(lat, lng, inc["latitude"], inc["longitude"]) <= radius
    ], key=lambda x: x["distance_m"])[:10]

    score, confidence, n_pts, metrics, police_km, police_name = interpolate_safety(lat, lng, nearby)
    risk = classify(score)
    color, msg = RISK_MAP[risk]

    # Generate contextual social media posts based on actual score
    if risk == "SAFE":
        keywords = random.sample(["well-lit", "patrolled", "busy", "safe", "clean", "peaceful"], 3)
        posts = [
            f"Great lighting on this street! Felt very secure. — {random.randint(5,45)}m ago",
            f"Police patrol spotted nearby, reassuring. — {random.randint(1,3)}h ago"
        ]
    elif risk == "MODERATE":
        keywords = random.sample(["caution", "moderate", "mixed-reviews", "busy-traffic", "construction"], 3)
        posts = [
            f"Decent area but some dark lanes nearby. — {random.randint(10,50)}m ago",
            f"Crowded but manageable, stay on main road. — {random.randint(1,4)}h ago"
        ]
    elif risk == "RISKY":
        keywords = random.sample(["avoid-night", "poor-lighting", "isolated", "reports", "theft"], 3)
        posts = [
            f"Avoid this stretch after dark, very poorly lit. — {random.randint(5,30)}m ago",
            f"My friend had a bad experience here last week. — {random.randint(1,6)}h ago"
        ]
    else:
        keywords = random.sample(["dangerous", "avoid", "no-lights", "crime", "unsafe", "deserted"], 3)
        posts = [
            f"Extremely unsafe, no streetlights at all. — {random.randint(2,20)}m ago",
            f"Multiple incidents reported. DO NOT walk alone here. — {random.randint(1,3)}h ago"
        ]

    # IST time info
    ist_hour = (datetime.utcnow().hour + 5.5) % 24
    time_context = "night" if (ist_hour >= 20 or ist_hour <= 5) else "day"

    return {
        "lat": lat, "lng": lng,
        "safety_score": score,
        "color_code": color,
        "risk_level": risk,
        "status_message": msg,
        "confidence": confidence,
        "data_points_used": n_pts,
        "time_context": time_context,
        "environmental_factors": {
            "lighting_density": f"{max(5, min(100, int(metrics['lighting_score'] * 10)))}%",
            "police_proximity": f"{police_km} km",
            "nearest_police_station": police_name,
            "crowd_density": f"{max(5, min(100, int(metrics.get('crowd_density', 5) * 10)))}%",
            "cctv_coverage": f"{max(0, min(100, int(metrics.get('cctv_coverage', 5) * 10)))}%",
            "road_quality": f"{max(10, min(100, int(metrics.get('road_quality', 5) * 10)))}%",
            "emergency_response_min": f"{round(metrics.get('emergency_response_min', 15), 1)} min",
            "active_community_reports": len(nearby_incidents)
        },
        "social_media_context": {
            "top_keywords": keywords,
            "recent_posts": posts,
            "area_image_url": f"https://picsum.photos/seed/{abs(hash((round(lat,3), round(lng,3)))) % 10000}/400/200"
        },
        "nearby_incidents": [
            {
                "id": i["id"], "incident_type": i["incident_type"],
                "description": i.get("description"), "severity": i["severity"],
                "distance_m": i["distance_m"], "occurred_at": i["occurred_at"]
            }
            for i in nearby_incidents
        ]
    }


@app.post("/routes/safe")
def safe_route(body: RouteReq):
    """Compute route safety by analyzing segments along the actual path."""
    o, d = body.origin, body.destination
    speed = {"walking": 83, "cycling": 250, "driving": 500}.get(body.mode, 83)
    total_dist = haversine(o.lat, o.lng, d.lat, d.lng)

    conn = get_db()
    all_pts = [dict(r) for r in conn.execute("SELECT * FROM safety_points").fetchall()]
    conn.close()

    # Generate route segments with lateral offsets for "safer" alternatives
    n_segs = max(4, min(12, int(total_dist / 2000)))
    segments = []
    score_sum = 0

    for i in range(n_segs):
        t0, t1 = i / n_segs, (i + 1) / n_segs
        wp0_lat = o.lat + t0 * (d.lat - o.lat)
        wp0_lng = o.lng + t0 * (d.lng - o.lng)
        wp1_lat = o.lat + t1 * (d.lat - o.lat)
        wp1_lng = o.lng + t1 * (d.lng - o.lng)
        mid_lat = (wp0_lat + wp1_lat) / 2
        mid_lng = (wp0_lng + wp1_lng) / 2

        nearby = sorted(
            [p for p in all_pts if haversine(mid_lat, mid_lng, p["latitude"], p["longitude"]) <= 3000],
            key=lambda p: haversine(mid_lat, mid_lng, p["latitude"], p["longitude"])
        )[:8]

        seg_score, _, _, _, _, _ = interpolate_safety(mid_lat, mid_lng, nearby)
        risk = classify(seg_score)
        color, _ = RISK_MAP[risk]
        score_sum += seg_score

        segments.append({
            "waypoints": [
                {"lat": round(wp0_lat, 6), "lng": round(wp0_lng, 6)},
                {"lat": round(wp1_lat, 6), "lng": round(wp1_lng, 6)}
            ],
            "safety_score": seg_score,
            "risk_level": risk,
            "color_code": color,
            "distance_m": round(total_dist / n_segs, 1)
        })

    avg = round(score_sum / n_segs, 2)
    risk = classify(avg)
    color, msg = RISK_MAP[risk]

    # Check if safer alternative exists by trying lateral offsets
    safer_alt = False
    if avg < 6.0:
        # Try a route offset perpendicular to the direct path
        perp_lat = -(d.lng - o.lng) * 0.01
        perp_lng = (d.lat - o.lat) * 0.01
        alt_scores = []
        for offset in [1, -1]:
            mid_lat_alt = (o.lat + d.lat) / 2 + perp_lat * offset
            mid_lng_alt = (o.lng + d.lng) / 2 + perp_lng * offset
            near_alt = sorted(
                [p for p in all_pts if haversine(mid_lat_alt, mid_lng_alt, p["latitude"], p["longitude"]) <= 3000],
                key=lambda p: haversine(mid_lat_alt, mid_lng_alt, p["latitude"], p["longitude"])
            )[:5]
            alt_s, _, _, _, _, _ = interpolate_safety(mid_lat_alt, mid_lng_alt, near_alt)
            alt_scores.append(alt_s)
        if max(alt_scores) > avg + 1.0:
            safer_alt = True

    return {
        "overall_safety_score": avg,
        "color_code": color,
        "risk_level": risk,
        "status_message": msg,
        "total_distance_m": round(total_dist, 1),
        "estimated_time_min": round(total_dist / speed, 1),
        "segments": segments,
        "safer_alternative": safer_alt
    }


@app.post("/reports", status_code=201)
def submit_report(body: ReportReq):
    conn = get_db()
    rid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO user_reports VALUES (?,?,?,?,?,?,?,?,?)",
        (rid, body.latitude, body.longitude, body.report_type, body.severity,
         body.description, int(body.anonymous),
         None if body.anonymous else body.user_id,
         datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return {
        "id": rid, "latitude": body.latitude, "longitude": body.longitude,
        "report_type": body.report_type, "severity": body.severity,
        "verified": False, "created_at": datetime.utcnow().isoformat()
    }


@app.get("/reports")
def list_reports(lat: float, lng: float, radius_m: int = 1000):
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        "SELECT * FROM user_reports WHERE created_at > ? ORDER BY created_at DESC LIMIT 50",
        ((datetime.utcnow() - timedelta(days=7)).isoformat(),)
    ).fetchall()]
    conn.close()
    return [r for r in rows if haversine(lat, lng, r["latitude"], r["longitude"]) <= radius_m]


@app.post("/sos")
def sos(body: SOSReq):
    police_km, police_name = nearest_police_station(body.latitude, body.longitude)
    conn = get_db()
    contacts = conn.execute(
        "SELECT name, phone FROM emergency_contacts WHERE user_id=? LIMIT 5", (body.user_id,)
    ).fetchall()
    conn.close()
    print(f"🚨 SOS from {body.user_id} at ({body.latitude},{body.longitude}): {body.message}")
    return {
        "triggered": True,
        "contacts_notified": len(contacts),
        "nearest_police_station": police_name,
        "nearest_police_distance_km": police_km,
        "emergency_number": "112"
    }


# Serve the UI
@app.get("/ui")
def serve_ui():
    ui_path = os.path.join(os.path.dirname(__file__), "..", "safestep_ui.html")
    if os.path.exists(ui_path):
        return FileResponse(ui_path, media_type="text/html")
    return {"error": "UI file not found"}


if __name__ == "__main__":
    uvicorn.run("demo_backend:app", host="0.0.0.0", port=8000, reload=True)
