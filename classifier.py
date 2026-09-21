"""
classifier.py - Multi-tier source classification engine for AgniDrishti.
Combines thermal metrics, facility proximity, land cover, spatial clustering,
and historical baseline behaviour into:
- INDUSTRIAL
- NATURAL / AGRICULTURAL
- UNCERTAIN

Includes classify_rule_based, classify_with_ml hook, and SourceClassifier class.
"""

from __future__ import annotations
from typing import Optional, Tuple
from config import ANOMALY_ZSCORE_THRESHOLD, FACILITY_PROXIMITY_M
from hotspots import (
    BaselineProfile,
    ClassificationCategory,
    ClusterInfo,
    FacilityInfo,
    HotspotRaw,
    LandCoverContext,
    LandCoverType,
)


def classify_rule_based(
    frp: float,
    distance_to_facility_m: Optional[float],
    land_cover: str,
    baseline_sample_count: int,
    zscore: Optional[float],
) -> dict:
    """
    Evaluates rule-based source classification.
    Returns {"source_type": ..., "behaviour": ..., "confidence_score": 0-1}
    """
    near_facility = distance_to_facility_m is not None and distance_to_facility_m <= FACILITY_PROXIMITY_M

    # ---- Level 1: source type ----------------------------------------
    if near_facility and land_cover == "industrial_builtup":
        source_type = "INDUSTRIAL"
        confidence = 0.9 if distance_to_facility_m < FACILITY_PROXIMITY_M / 2 else 0.75
    elif not near_facility and land_cover in ("agricultural", "forest") and baseline_sample_count == 0:
        source_type = "NATURAL"
        confidence = 0.6
    elif near_facility and land_cover != "industrial_builtup":
        source_type = "UNCERTAIN"
        confidence = 0.4
    elif not near_facility and baseline_sample_count == 0:
        source_type = "UNCERTAIN"
        confidence = 0.35
    else:
        source_type = "UNCERTAIN"
        confidence = 0.4

    # ---- Level 2: behaviour (only meaningful for INDUSTRIAL) ----------
    behaviour = None
    if source_type == "INDUSTRIAL":
        if baseline_sample_count == 0:
            source_type = "UNCERTAIN"
            behaviour = None
            confidence = 0.4
        elif zscore is not None and abs(zscore) >= ANOMALY_ZSCORE_THRESHOLD:
            behaviour = "NEW_ANOMALOUS"
            confidence = min(confidence + 0.08, 0.98)
        else:
            behaviour = "KNOWN_EXPECTED"

    return {
        "source_type": source_type,
        "behaviour": behaviour,
        "confidence_score": round(confidence, 2),
    }


def classify_with_ml(feature_vector: dict) -> dict:
    """
    Placeholder hook for XGBoost/LightGBM model.
    """
    raise NotImplementedError(
        "ML classifier not trained yet - use classify_rule_based() for now."
    )


class SourceClassifier:
    """Classifies satellite thermal detections into INDUSTRIAL, NATURAL, or UNCERTAIN."""

    def __init__(self, uncertainty_margin: float = 15.0):
        self.uncertainty_margin = uncertainty_margin

    def classify(
        self,
        hotspot: HotspotRaw,
        facility: Optional[FacilityInfo],
        land_cover: LandCoverContext,
        cluster: ClusterInfo,
        baseline: Optional[BaselineProfile] = None,
    ) -> Tuple[ClassificationCategory, float]:
        """
        Calculates evidence scores for INDUSTRIAL vs NATURAL and decides the category.
        Returns: (ClassificationCategory, confidence_score [0.0 - 1.0])
        """
        industrial_score = 0.0
        natural_score = 0.0

        # 1. Spatial Proximity to Industrial Infrastructure
        if facility:
            dist = facility.distance_meters
            if dist <= 300.0:
                industrial_score += 50.0
            elif dist <= 600.0:
                industrial_score += 35.0
            elif dist <= 1200.0:
                industrial_score += 15.0
            elif dist <= 2000.0:
                industrial_score += 5.0
            else:
                natural_score += 15.0

            if facility.facility_type in ["refinery", "chemical", "power_plant", "steelworks"]:
                industrial_score += 15.0
        else:
            natural_score += 35.0

        # 2. Land Cover Context
        if land_cover.dominant_type == LandCoverType.BUILT_UP_INDUSTRIAL:
            industrial_score += 40.0 * land_cover.confidence
        elif land_cover.dominant_type == LandCoverType.FOREST:
            natural_score += 45.0 * land_cover.confidence
        elif land_cover.dominant_type == LandCoverType.AGRICULTURE:
            natural_score += 40.0 * land_cover.confidence
        elif land_cover.dominant_type == LandCoverType.SHRUBLAND:
            natural_score += 30.0 * land_cover.confidence

        # 3. Historical Recurrence & Baseline
        if baseline and baseline.is_known_recurring:
            industrial_score += 45.0
            if baseline.historical_days_active_30d >= 20:
                industrial_score += 15.0
        elif baseline and baseline.sample_count > 0:
            industrial_score += 20.0

        # 4. Temporal / Diurnal Behaviour
        daynight = (hotspot.daynight or "").upper()
        if daynight == "N":
            industrial_score += 15.0
        elif daynight == "D":
            natural_score += 10.0

        # 5. Satellite Confidence
        conf_str = str(hotspot.confidence or "").lower()
        if conf_str in ("l", "low"):
            industrial_score *= 0.8
            natural_score *= 0.8

        # 6. Evaluate Scores and Handle Uncertainty
        max_possible = 160.0
        ind_norm = min(1.0, industrial_score / max_possible)
        nat_norm = min(1.0, natural_score / max_possible)

        score_diff = abs(industrial_score - natural_score)

        # Step 8: Handle Uncertainty (High FRP, no nearby facility, no historical baseline, night/low confidence)
        if (
            hotspot.frp >= 75.0
            and (facility is None or facility.distance_meters > 1500.0)
            and (baseline is None or not baseline.is_known_recurring)
            and (daynight == "N" or conf_str in ("l", "low"))
            and land_cover.dominant_type != LandCoverType.FOREST
        ):
            return ClassificationCategory.UNCERTAIN, 0.45

        if (industrial_score > 30.0 and natural_score > 30.0 and score_diff < self.uncertainty_margin) or (
            industrial_score < 40.0 and natural_score < 40.0
        ):
            conf = round(max(ind_norm, nat_norm), 2)
            return ClassificationCategory.UNCERTAIN, min(conf, 0.60)

        if industrial_score > natural_score:
            conf = round(ind_norm, 2)
            return ClassificationCategory.INDUSTRIAL, max(0.65, conf)
        else:
            conf = round(nat_norm, 2)
            return ClassificationCategory.NATURAL, max(0.65, conf)