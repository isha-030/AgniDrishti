"""
priority.py - Priority assignment engine for AgniDrishti.
Assigns actionable triage priorities (LOW, MEDIUM, HIGH) based on baseline deviation,
facility criticality, thermal intensity (FRP), and verification certainty.
"""

from __future__ import annotations
from typing import Optional, Tuple
from hotspots import (
    BaselineComparison,
    ClassificationCategory,
    ClusterInfo,
    EvidenceReport,
    FacilityInfo,
    HotspotRaw,
    IndustrialStatus,
    PriorityLevel,
)


class PriorityEngine:
    """Computes actionable response priority (LOW, MEDIUM, HIGH) with human-readable rationale."""

    def assign_priority(
        self,
        classification: ClassificationCategory,
        industrial_status: IndustrialStatus,
        baseline_comp: BaselineComparison,
        hotspot: HotspotRaw,
        facility: Optional[FacilityInfo],
        cluster: ClusterInfo,
        evidence: EvidenceReport,
    ) -> Tuple[PriorityLevel, str]:
        """
        Determines the priority level and provides an explanatory reason for analysts.
        """
        # 1. Check for HIGH Priority Cases (Red Alert)
        # Case 1A: Industrial Anomaly at an established facility (e.g. Current FRP 350 vs Baseline 81)
        if classification == ClassificationCategory.INDUSTRIAL and industrial_status == IndustrialStatus.NEW_ANOMALOUS:
            ratio_str = f"{baseline_comp.frp_ratio:.1f}x" if baseline_comp.frp_ratio else "elevated"
            facility_name = facility.name if facility else "industrial facility"
            return (
                PriorityLevel.HIGH,
                f"CRITICAL ANOMALY: Industrial activity at {facility_name} is {ratio_str} above normal baseline "
                f"(current FRP {hotspot.frp:.1f} MW). Potential blowout, malfunction, or uncontrolled thermal event.",
            )

        # Case 1B: Massive thermal cluster or intense heat near hazardous infrastructure
        if facility and facility.is_hazardous and facility.distance_meters <= 600.0 and hotspot.frp >= 100.0:
            return (
                PriorityLevel.HIGH,
                f"HIGH THREAT: Severe thermal intensity ({hotspot.frp:.1f} MW) within {facility.distance_meters:.0f}m "
                f"of hazardous infrastructure ({facility.name}).",
            )

        # Case 1C: Massive wildfire front (cluster FRP > 400 MW)
        if cluster.total_frp >= 400.0 and classification == ClassificationCategory.NATURAL:
            return (
                PriorityLevel.HIGH,
                f"HIGH THREAT: Large-scale active wildfire cluster with aggregated FRP of {cluster.total_frp:.1f} MW "
                f"across {cluster.size} satellite detection points.",
            )

        # 2. Check for LOW Priority Cases (Green / Routine)
        # Case 2A: Industrial Known / Expected (Routine refinery flaring or furnace output)
        if classification == ClassificationCategory.INDUSTRIAL and industrial_status == IndustrialStatus.KNOWN_EXPECTED:
            facility_name = facility.name if facility else "facility"
            return (
                PriorityLevel.LOW,
                f"Routine Activity: Normal operational heat output at {facility_name}. "
                f"Matches historical baseline (~{baseline_comp.baseline_mean_frp:.1f} MW). No anomaly.",
            )

        # Case 2B: Small, isolated agricultural stubble fire
        if classification == ClassificationCategory.NATURAL and hotspot.frp < 30.0:
            dist_desc = f"{facility.distance_meters:.0f}m from any facility" if facility else "far from infrastructure"
            return (
                PriorityLevel.LOW,
                f"Low Impact: Routine small-scale agricultural/vegetative fire ({hotspot.frp:.1f} MW), {dist_desc}.",
            )

        # 3. All other cases qualify as MEDIUM Priority (Yellow / Review)
        # Case 3A: Uncertain Detections
        if classification == ClassificationCategory.UNCERTAIN:
            return (
                PriorityLevel.MEDIUM,
                "NEEDS REVIEW: Uncertain thermal detection with ambiguous or conflicting contextual signals. "
                "Manual analyst review advised.",
            )

        # Case 3B: Moderate natural/vegetation fires
        if classification == ClassificationCategory.NATURAL:
            return (
                PriorityLevel.MEDIUM,
                f"Moderate vegetative/forest fire detected with FRP of {hotspot.frp:.1f} MW. Monitoring recommended.",
            )

        # Default fallback
        return (
            PriorityLevel.MEDIUM,
            f"Moderate priority thermal detection (FRP {hotspot.frp:.1f} MW) flagged for monitoring.",
        )
