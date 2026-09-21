"""
evidence.py - Evidence verification and uncertainty handling module for AgniDrishti.
Systematically audits supporting evidence and counter-evidence for every classification
to prevent false alarms and ensure human-verifiable explainability.
"""

from __future__ import annotations
from typing import Optional, Tuple
from hotspots import (
    BaselineProfile,
    ClassificationCategory,
    ClusterInfo,
    EvidenceItem,
    EvidenceReport,
    FacilityInfo,
    HotspotRaw,
    LandCoverContext,
    LandCoverType,
)


class EvidenceVerifier:
    """Verifies classification integrity by contrasting supporting signals against counter-evidence."""

    def verify(
        self,
        candidate_class: ClassificationCategory,
        hotspot: HotspotRaw,
        facility: Optional[FacilityInfo],
        land_cover: LandCoverContext,
        cluster: ClusterInfo,
        baseline: Optional[BaselineProfile] = None,
    ) -> Tuple[ClassificationCategory, EvidenceReport]:
        """
        Gathers evidence items, weighs supporting vs counter-evidence,
        and determines whether the classification is verified or should be UNCERTAIN.
        """
        supporting: list[EvidenceItem] = []
        counter: list[EvidenceItem] = []

        # --- 1. Audit Proximity to Facility ---
        if facility:
            dist = facility.distance_meters
            if dist <= 350.0:
                supporting.append(
                    EvidenceItem(
                        factor="facility_proximity",
                        signal="SUPPORT" if candidate_class == ClassificationCategory.INDUSTRIAL else "COUNTER",
                        weight=2.5,
                        description=f"Direct proximity: {dist:.0f}m from {facility.name} ({facility.facility_type})",
                    )
                )
            elif dist <= 800.0:
                supporting.append(
                    EvidenceItem(
                        factor="facility_proximity",
                        signal="SUPPORT" if candidate_class == ClassificationCategory.INDUSTRIAL else "NEUTRAL",
                        weight=1.5,
                        description=f"Nearby industrial buffer: {dist:.0f}m from {facility.name}",
                    )
                )
            elif dist > 1500.0 and candidate_class == ClassificationCategory.INDUSTRIAL:
                counter.append(
                    EvidenceItem(
                        factor="facility_distance",
                        signal="COUNTER",
                        weight=2.0,
                        description=f"No facility in immediate vicinity (closest {facility.name} is {dist:.0f}m away)",
                    )
                )
        else:
            if candidate_class == ClassificationCategory.INDUSTRIAL:
                counter.append(
                    EvidenceItem(
                        factor="no_facility",
                        signal="COUNTER",
                        weight=3.0,
                        description="No industrial facility detected within 3000m search radius",
                    )
                )
            elif candidate_class == ClassificationCategory.NATURAL:
                supporting.append(
                    EvidenceItem(
                        factor="isolated_location",
                        signal="SUPPORT",
                        weight=1.5,
                        description="Isolated location with zero industrial infrastructure detected",
                    )
                )

        # --- 2. Audit Land Cover Context ---
        if land_cover.dominant_type == LandCoverType.BUILT_UP_INDUSTRIAL:
            if candidate_class == ClassificationCategory.INDUSTRIAL:
                supporting.append(
                    EvidenceItem(
                        factor="land_cover",
                        signal="SUPPORT",
                        weight=2.0,
                        description=f"Land cover matches industrial/built-up use ({land_cover.description})",
                    )
                )
            else:
                counter.append(
                    EvidenceItem(
                        factor="land_cover_conflict",
                        signal="COUNTER",
                        weight=2.0,
                        description="Land cover is built-up/industrial, contradicting natural classification",
                    )
                )
        elif land_cover.dominant_type in (LandCoverType.FOREST, LandCoverType.AGRICULTURE):
            if candidate_class == ClassificationCategory.NATURAL:
                supporting.append(
                    EvidenceItem(
                        factor="land_cover",
                        signal="SUPPORT",
                        weight=2.0,
                        description=f"Surrounding terrain is {land_cover.dominant_type.value} ({land_cover.description})",
                    )
                )
            elif candidate_class == ClassificationCategory.INDUSTRIAL and (not facility or facility.distance_meters > 500.0):
                counter.append(
                    EvidenceItem(
                        factor="land_cover_conflict",
                        signal="COUNTER",
                        weight=2.5,
                        description=f"Surrounding terrain is {land_cover.dominant_type.value}, counter-indicating industrial plant",
                    )
                )

        # --- 3. Audit Historical Baseline ---
        if baseline and baseline.is_known_recurring:
            if candidate_class == ClassificationCategory.INDUSTRIAL:
                supporting.append(
                    EvidenceItem(
                        factor="historical_recurrence",
                        signal="SUPPORT",
                        weight=2.5,
                        description=f"Proven recurring thermal source ({baseline.historical_days_active_30d}/30 days active in baseline)",
                    )
                )
            else:
                counter.append(
                    EvidenceItem(
                        factor="historical_recurrence_conflict",
                        signal="COUNTER",
                        weight=2.0,
                        description="Site has persistent historical thermal baseline typical of industrial operations",
                    )
                )
        else:
            if candidate_class == ClassificationCategory.INDUSTRIAL:
                counter.append(
                    EvidenceItem(
                        factor="lack_of_baseline",
                        signal="COUNTER",
                        weight=1.0,
                        description="No prior historical thermal signature established for this coordinate",
                    )
                )

        # --- 4. Audit Diurnal / Satellite Confidence ---
        if hotspot.daynight == "N" and candidate_class == ClassificationCategory.INDUSTRIAL:
            supporting.append(
                EvidenceItem(
                    factor="diurnal_pattern",
                    signal="SUPPORT",
                    weight=1.0,
                    description="Night-time detection consistent with continuous industrial flaring",
                )
            )

        conf_str = str(hotspot.confidence or "").lower()
        if conf_str in ("l", "low"):
            counter.append(
                EvidenceItem(
                    factor="low_satellite_confidence",
                    signal="COUNTER",
                    weight=1.5,
                    description="NASA FIRMS detection confidence flagged as low",
                )
            )

        # --- 5. Conflict Resolution & Final Audit ---
        total_support = sum(e.weight for e in supporting)
        total_counter = sum(e.weight for e in counter)
        net_score = round(total_support - total_counter, 2)
        has_conflicts = total_counter >= 3.0 and total_support <= total_counter * 1.5

        final_class = candidate_class
        summary = ""

        if candidate_class == ClassificationCategory.UNCERTAIN or has_conflicts:
            final_class = ClassificationCategory.UNCERTAIN
            summary = (
                "UNCERTAIN — NEEDS REVIEW: Evidence is mixed or insufficient to confirm a source with high confidence."
            )
        elif candidate_class == ClassificationCategory.INDUSTRIAL:
            summary = "Verified Industrial Source: Supported by facility proximity, land use, and historical baseline."
        elif candidate_class == ClassificationCategory.NATURAL:
            summary = "Verified Natural/Agricultural Source: Supported by vegetative terrain and absence of industrial infrastructure."

        report = EvidenceReport(
            supporting_evidence=supporting,
            counter_evidence=counter,
            net_score=net_score,
            has_conflicts=has_conflicts,
            summary=summary,
        )

        return final_class, report
