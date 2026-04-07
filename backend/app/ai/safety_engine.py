"""
SafeStep AI Safety Engine
Weighted Linear Regression + KNN hybrid model for computing Safety Index
"""

import numpy as np
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge
from typing import List, Tuple, Optional
import logging
import math

logger = logging.getLogger("safestep.ai")


# ─── Constants ────────────────────────────────────────────────────────────────
# Feature weights for the Weighted Linear Regression model
# Higher weight = more influential on final score
FEATURE_WEIGHTS = {
    "lighting_score":        0.20,  # Street lighting quality
    "police_proximity_km":   0.25,  # Proximity to police (inverted — closer = safer)
    "sentiment_score":       0.20,  # Social/news sentiment
    "crowd_density":         0.15,  # Crowd density (moderate = safer)
    "incident_rate":         0.20,  # Normalized incident density (inverted)
}

# Thresholds for risk classification
RISK_THRESHOLDS = {
    "SAFE":     (7.5, 10.0),
    "MODERATE": (5.0, 7.5),
    "RISKY":    (2.5, 5.0),
    "DANGER":   (0.0, 2.5),
}

COLOR_MAP = {
    "SAFE":     "#00E676",   # Green
    "MODERATE": "#FFEA00",   # Yellow
    "RISKY":    "#FF6D00",   # Orange
    "DANGER":   "#D50000",   # Red
}

STATUS_MESSAGES = {
    "SAFE":     "This area is generally safe. Enjoy your journey! 🟢",
    "MODERATE": "Exercise normal caution in this area. 🟡",
    "RISKY":    "This area has elevated risk. Stay alert and stay on busy streets. 🟠",
    "DANGER":   "High-risk area detected. Consider an alternate route. 🔴",
}


# ─── Feature Engineering ──────────────────────────────────────────────────────

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in meters between two geo-coordinates."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def extract_features(point: dict) -> np.ndarray:
    """
    Convert a raw SafetyPoint dict into a normalized feature vector.
    All features are normalized to [0, 1] where 1 is always 'more safe'.
    """
    lighting = point.get("lighting_score", 5.0) / 10.0

    # Police proximity: closer = safer. Sigmoid-like inversion capped at 10km
    police_km = min(point.get("police_proximity_km", 2.0), 10.0)
    police_score = 1.0 - (police_km / 10.0)

    sentiment = point.get("sentiment_score", 5.0) / 10.0

    # Crowd density: moderate density (4–7) is safest
    crowd = point.get("crowd_density", 5.0)
    crowd_score = 1.0 - abs(crowd - 5.5) / 5.5  # peak at 5.5

    # Incident rate: lower = safer
    incidents = min(point.get("incident_count_30d", 0), 50)
    incident_score = 1.0 - (incidents / 50.0)

    return np.array([lighting, police_score, sentiment, crowd_score, incident_score])


def compute_weighted_score(features: np.ndarray) -> float:
    """Applies FEATURE_WEIGHTS to a normalized feature vector → score [0, 10]."""
    weights = np.array(list(FEATURE_WEIGHTS.values()))
    raw = float(np.dot(features, weights))
    return round(min(max(raw * 10.0, 0.0), 10.0), 2)


# ─── KNN Model ────────────────────────────────────────────────────────────────

class SafetyKNNModel:
    """
    K-Nearest Neighbors model trained on existing SafetyPoints.
    Used when sufficient data is available (>= 5 points).
    Falls back to Weighted Linear Regression otherwise.
    """

    def __init__(self, n_neighbors: int = 5):
        self.n_neighbors = n_neighbors
        self.model = Pipeline([
            ("scaler", MinMaxScaler()),
            ("knn", KNeighborsRegressor(
                n_neighbors=n_neighbors,
                weights="distance",  # Closer points have more influence
                metric="euclidean",
            )),
        ])
        self.is_trained = False
        self.training_size = 0

    def train(self, points: List[dict]) -> None:
        """Train KNN on a list of SafetyPoint dicts."""
        if len(points) < self.n_neighbors:
            logger.warning(f"Not enough points to train KNN ({len(points)} < {self.n_neighbors})")
            return

        X = np.array([extract_features(p) for p in points])
        y = np.array([p.get("safety_index") or compute_weighted_score(extract_features(p)) for p in points])

        self.model.fit(X, y)
        self.is_trained = True
        self.training_size = len(points)
        logger.info(f"KNN model trained on {len(points)} safety points.")

    def predict(self, point: dict) -> Tuple[float, float]:
        """Returns (predicted_score, confidence). Confidence based on neighbor distances."""
        if not self.is_trained:
            score = compute_weighted_score(extract_features(point))
            return score, 0.4  # Low confidence — no training data

        X = extract_features(point).reshape(1, -1)
        prediction = float(self.model.predict(X)[0])
        prediction = round(min(max(prediction, 0.0), 10.0), 2)

        # Confidence heuristic: more training data = higher confidence
        confidence = min(0.95, 0.5 + (self.training_size / 200))
        return prediction, round(confidence, 2)


# ─── Main Safety Engine ───────────────────────────────────────────────────────

class SafetyEngine:
    """
    Main orchestrator: combines WLR interpolation and KNN for a final safety score.
    """

    def __init__(self):
        self.knn_model = SafetyKNNModel(n_neighbors=5)
        self._points_cache: List[dict] = []

    def retrain(self, all_points: List[dict]) -> None:
        """Retrain the KNN model with latest database points."""
        self._points_cache = all_points
        self.knn_model.train(all_points)

    def interpolate_for_location(
        self,
        lat: float,
        lng: float,
        nearby_points: List[dict],
    ) -> Tuple[float, float, int]:
        """
        Interpolate a safety score for a coordinate from nearby data points.

        Returns:
            (safety_score, confidence, data_points_used)
        """
        if not nearby_points:
            # No data — return neutral score with zero confidence
            return 5.0, 0.0, 0

        if len(nearby_points) == 1:
            features = extract_features(nearby_points[0])
            score = compute_weighted_score(features)
            return score, 0.3, 1

        # Distance-weighted average of nearby point scores
        scores = []
        weights = []

        for p in nearby_points:
            dist = haversine_distance(lat, lng, p["latitude"], p["longitude"])
            dist = max(dist, 1.0)  # Avoid division by zero

            features = extract_features(p)
            point_score = p.get("safety_index") or compute_weighted_score(features)

            # Inverse distance weighting
            w = 1.0 / (dist ** 2)
            scores.append(point_score)
            weights.append(w)

        weights = np.array(weights)
        scores = np.array(scores)
        weighted_score = float(np.average(scores, weights=weights))
        weighted_score = round(min(max(weighted_score, 0.0), 10.0), 2)

        # Also get KNN prediction if possible
        if self.knn_model.is_trained and len(nearby_points) >= 3:
            # Use centroid-like synthetic point from nearest neighbors
            avg_point = {
                "lighting_score": float(np.mean([p.get("lighting_score", 5) for p in nearby_points[:3]])),
                "police_proximity_km": float(np.mean([p.get("police_proximity_km", 2) for p in nearby_points[:3]])),
                "sentiment_score": float(np.mean([p.get("sentiment_score", 5) for p in nearby_points[:3]])),
                "crowd_density": float(np.mean([p.get("crowd_density", 5) for p in nearby_points[:3]])),
                "incident_count_30d": int(np.mean([p.get("incident_count_30d", 0) for p in nearby_points[:3]])),
            }
            knn_score, knn_conf = self.knn_model.predict(avg_point)

            # Blend WLR (60%) + KNN (40%)
            final_score = round(0.6 * weighted_score + 0.4 * knn_score, 2)
            confidence = round(min(knn_conf + 0.1, 0.95), 2)
        else:
            final_score = weighted_score
            confidence = round(min(0.3 + len(nearby_points) * 0.08, 0.85), 2)

        return final_score, confidence, len(nearby_points)

    def classify(self, score: float) -> Tuple[str, str, str]:
        """Returns (risk_level, color_code, status_message) for a score."""
        for level, (low, high) in RISK_THRESHOLDS.items():
            if low <= score <= high:
                return level, COLOR_MAP[level], STATUS_MESSAGES[level]
        return "MODERATE", COLOR_MAP["MODERATE"], STATUS_MESSAGES["MODERATE"]


# Singleton instance
safety_engine = SafetyEngine()
