"""
baseline.py - Site-specific thermal baseline and temporal anomaly detection module.
Maintains historical thermal baselines (typical FRP, recurrence rate, day/night ratio)
and determines whether current activity at an industrial site is KNOWN/EXPECTED or NEW/ANOMALOUS.
Includes both cluster-based baseline builders and persistent spatial baseline profiles.
"""

from __future__ import annotations
import math
import statistics
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import numpy as np
from config import MIN_BASELINE_SAMPLES
from hotspots import (
    BaselineComparison,
    BaselineProfile,
    FacilityInfo,
    HotspotRaw,
    IndustrialStatus,
    RawHotspot,
)
from osm_client import haversine_distance_meters


class SiteBaseline:
    """Historical FRP distribution summary for a site/cluster."""

    def __init__(self, mean_frp: Optional[float], std_frp: Optional[float], sample_count: int):
        self.mean_frp = mean_frp
        self.std_frp = std_frp
        self.sample_count = sample_count

    def zscore(self, current_frp: float) -> Optional[float]:
        if self.mean_frp is None or not self.std_frp or self.std_frp == 0:
            return None
        return (current_frp - self.mean_frp) / self.std_frp

    def has_enough_history(self) -> bool:
        return self.sample_count >= MIN_BASELINE_SAMPLES


def compute_baselines(cluster_groups: Dict[int, List[RawHotspot]]) -> Dict[int, SiteBaseline]:
    """
    For each cluster, split into "history" (all but the latest date) and use
    history's FRP values to build the baseline. If a cluster only has one
    date's worth of detections, there's no history yet -> baseline is empty,
    which downstream forces an UNCERTAIN / can't-confirm-behaviour result.
    """
    baselines: Dict[int, SiteBaseline] = {}
    for cluster_id, points in cluster_groups.items():
        dates = sorted(set(p.acq_date for p in points if p.acq_date))
        if len(dates) <= 1:
            baselines[cluster_id] = SiteBaseline(None, None, 0)
            continue

        latest_date = dates[-1]
        history_points = [p for p in points if p.acq_date != latest_date]
        frps = [p.frp for p in history_points]

        if len(frps) < 2:
            baselines[cluster_id] = SiteBaseline(
                mean_frp=frps[0] if frps else None, std_frp=0, sample_count=len(frps)
            )
            continue

        baselines[cluster_id] = SiteBaseline(
            mean_frp=statistics.mean(frps),
            std_frp=statistics.stdev(frps),
            sample_count=len(frps),
        )
    return baselines


def latest_detection_per_cluster(cluster_groups: Dict[int, List[RawHotspot]]) -> Dict[int, RawHotspot]:
    """
    The most recent detection per cluster is what we actually classify -
    history is only used to build the baseline it's compared against.
    """
    latest: Dict[int, RawHotspot] = {}
    for cluster_id, points in cluster_groups.items():
        latest[cluster_id] = max(
            points, key=lambda p: (str(p.acq_date or ""), str(p.acq_time or ""))
        )
    return latest


class BaselineEngine:
    """Computes and queries site-specific thermal baselines to detect operational anomalies."""

    def __init__(self):
        self._profiles: Dict[str, BaselineProfile] = {}
        self._location_coords: Dict[str, Tuple[float, float]] = {}
        self._init_default_baselines()

    def _init_default_baselines(self):
        """Initializes known historical baselines for major reference facilities."""
        # 1. Jamnagar Reliance Refinery (Routine recurring gas flaring)
        self.register_profile(
            location_id="refinery-jamnagar",
            lat=22.3840,
            lon=69.8520,
            profile=BaselineProfile(
                location_id="refinery-jamnagar",
                sample_count=85,
                historical_days_active_30d=29,
                recurrence_rate=0.97,
                mean_frp=82.4,
                std_frp=4.8,
                median_frp=82.0,
                min_frp=72.0,
                max_frp=94.0,
                day_detection_ratio=0.45,
                is_known_recurring=True,
            ),
        )

        # 2. BPCL/HPCL Mumbai Refinery (Routine flaring baseline ~81.2 MW)
        self.register_profile(
            location_id="refinery-mumbai-mahul",
            lat=19.0120,
            lon=72.8990,
            profile=BaselineProfile(
                location_id="refinery-mumbai-mahul",
                sample_count=90,
                historical_days_active_30d=28,
                recurrence_rate=0.93,
                mean_frp=81.2,
                std_frp=5.2,
                median_frp=80.5,
                min_frp=70.0,
                max_frp=92.0,
                day_detection_ratio=0.50,
                is_known_recurring=True,
            ),
        )

        # 3. Tata Steel Jamshedpur (Furnaces baseline ~115 MW)
        self.register_profile(
            location_id="steelworks-jamshedpur",
            lat=22.7980,
            lon=86.1950,
            profile=BaselineProfile(
                location_id="steelworks-jamshedpur",
                sample_count=60,
                historical_days_active_30d=26,
                recurrence_rate=0.87,
                mean_frp=115.0,
                std_frp=12.0,
                median_frp=114.0,
                min_frp=90.0,
                max_frp=140.0,
                day_detection_ratio=0.52,
                is_known_recurring=True,
            ),
        )

        # 4. Hazira Petrochemicals baseline ~65 MW
        self.register_profile(
            location_id="petrochem-hazira",
            lat=21.1120,
            lon=72.6350,
            profile=BaselineProfile(
                location_id="petrochem-hazira",
                sample_count=55,
                historical_days_active_30d=24,
                recurrence_rate=0.80,
                mean_frp=65.0,
                std_frp=6.5,
                median_frp=64.0,
                min_frp=52.0,
                max_frp=78.0,
                day_detection_ratio=0.48,
                is_known_recurring=True,
            ),
        )

    def register_profile(self, location_id: str, lat: float, lon: float, profile: BaselineProfile):
        self._profiles[location_id] = profile
        self._location_coords[location_id] = (lat, lon)

    def find_baseline(
        self, lat: float, lon: float, max_radius_meters: float = 1200.0
    ) -> Optional[BaselineProfile]:
        closest_id = None
        min_dist = float("inf")

        for loc_id, (b_lat, b_lon) in self._location_coords.items():
            dist = haversine_distance_meters(lat, lon, b_lat, b_lon)
            if dist <= max_radius_meters and dist < min_dist:
                min_dist = dist
                closest_id = loc_id

        if closest_id:
            return self._profiles[closest_id]
        return None

    def compare_with_baseline(
        self,
        hotspot: HotspotRaw,
        facility: Optional[FacilityInfo] = None,
        is_industrial_candidate: bool = False,
    ) -> BaselineComparison:
        """
        Step 6: Evaluates whether current hotspot activity at an industrial facility
        is normal or anomalous:
        - Case A (Normal): Current FRP matches historical baseline -> KNOWN_EXPECTED
        - Case B (Unusual): Current FRP significantly spikes above baseline -> NEW_ANOMALOUS
        """
        if not is_industrial_candidate and (facility is None or facility.distance_meters > 1200.0):
            return BaselineComparison(
                current_frp=hotspot.frp,
                status=IndustrialStatus.NOT_APPLICABLE,
                explanation="Detection is not associated with an industrial facility.",
            )

        baseline = self.find_baseline(hotspot.latitude, hotspot.longitude)

        if baseline is None:
            if facility and facility.distance_meters <= 500.0:
                return BaselineComparison(
                    current_frp=hotspot.frp,
                    status=IndustrialStatus.NEW_ANOMALOUS,
                    explanation=(
                        f"New thermal signature at {facility.name} (distance {facility.distance_meters:.0f}m). "
                        "No prior historical baseline recorded for this site."
                    ),
                )
            return BaselineComparison(
                current_frp=hotspot.frp,
                status=IndustrialStatus.NOT_APPLICABLE,
                explanation="No baseline data available for comparison.",
            )

        mean_frp = baseline.mean_frp
        std_frp = max(baseline.std_frp, 4.0)
        frp_ratio = round(hotspot.frp / max(mean_frp, 1.0), 2)
        z_score = round((hotspot.frp - mean_frp) / std_frp, 2)

        # Case A: Normal (Expected operational flare or thermal output)
        if frp_ratio <= 1.6 and z_score <= 2.2:
            return BaselineComparison(
                current_frp=hotspot.frp,
                baseline_mean_frp=mean_frp,
                baseline_std_frp=std_frp,
                frp_ratio=frp_ratio,
                z_score=z_score,
                status=IndustrialStatus.KNOWN_EXPECTED,
                explanation=(
                    f"Routine thermal activity matching baseline. Current FRP ({hotspot.frp} MW) is within "
                    f"normal bounds (baseline {mean_frp:.1f} ± {std_frp:.1f} MW, ratio {frp_ratio}x, z-score {z_score}). "
                    f"Recurring site active {baseline.historical_days_active_30d}/30 days."
                ),
            )

        # Case B: Unusual / Severe Anomaly
        return BaselineComparison(
            current_frp=hotspot.frp,
            baseline_mean_frp=mean_frp,
            baseline_std_frp=std_frp,
            frp_ratio=frp_ratio,
            z_score=z_score,
            status=IndustrialStatus.NEW_ANOMALOUS,
            explanation=(
                f"ANOMALY DETECTED: Current FRP ({hotspot.frp} MW) is {frp_ratio}x above typical baseline "
                f"({mean_frp:.1f} MW) with z-score {z_score:+.1f}. "
                f"Significant departure from normal operational behaviour at {facility.name if facility else 'recurring facility'}."
            ),
        )

    def learn_baseline_from_detections(
        self, location_id: str, lats: List[float], lons: List[float], frps: List[float]
    ) -> BaselineProfile:
        if not frps:
            raise ValueError("No detections provided to compute baseline.")

        arr = np.array(frps)
        mean_v = float(np.mean(arr))
        std_v = float(np.std(arr)) if len(arr) > 1 else 5.0
        med_v = float(np.median(arr))
        min_v = float(np.min(arr))
        max_v = float(np.max(arr))

        profile = BaselineProfile(
            location_id=location_id,
            sample_count=len(frps),
            historical_days_active_30d=min(30, len(frps)),
            recurrence_rate=min(1.0, len(frps) / 30.0),
            mean_frp=round(mean_v, 1),
            std_frp=round(std_v, 1),
            median_frp=round(med_v, 1),
            min_frp=round(min_v, 1),
            max_frp=round(max_v, 1),
            is_known_recurring=len(frps) >= 5,
        )
        self.register_profile(location_id, float(np.mean(lats)), float(np.mean(lons)), profile)
        return profile