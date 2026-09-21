"""
pipeline.py - AgniDrishti End-to-End Analysis Pipeline.
Orchestrates Ingestion -> Context Enrichment -> Spatial DBSCAN -> Baseline Analysis
-> Classification -> Evidence Verification -> Priority Scoring -> GIS GeoJSON generation.
"""

from __future__ import annotations
import asyncio
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from baseline import BaselineEngine
from classifier import SourceClassifier
from clustering import SpatialClusterer
from enrichment import ContextEnricher
from evidence import EvidenceVerifier
from hotspots import (
    AgniDrishtiResult,
    BatchAnalysisResponse,
    ClassificationCategory,
    ClusterInfo,
    FacilityInfo,
    HotspotRaw,
    IndustrialStatus,
    LandCoverContext,
    PriorityLevel,
)
from ingest import parse_datetime
from osm_client import OsmClient
from priority import PriorityEngine
from database import save_hotspots


class AgniDrishtiPipeline:
    """Complete intelligence pipeline for satellite thermal hotspot analysis."""

    def __init__(
        self,
        osm_client: Optional[OsmClient] = None,
        db_path: str = "agnidrishti.db",
    ):
        self.osm_client = osm_client or OsmClient()
        self.enricher = ContextEnricher(self.osm_client)
        self.clusterer = SpatialClusterer(eps_km=1.0, min_samples=1)
        self.baseline_engine = BaselineEngine()
        self.classifier = SourceClassifier()
        self.verifier = EvidenceVerifier()
        self.priority_engine = PriorityEngine()
        self.db_path = db_path
        self._init_sqlite()

    def _init_sqlite(self):
        """Initializes SQLite database schema for persisting hotspot analyses and baselines."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS analyzed_hotspots (
                        id TEXT PRIMARY KEY,
                        latitude REAL,
                        longitude REAL,
                        acq_datetime TEXT,
                        frp REAL,
                        confidence TEXT,
                        classification TEXT,
                        industrial_status TEXT,
                        priority TEXT,
                        facility_name TEXT,
                        cluster_id INTEGER,
                        created_at TEXT
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS facility_baselines (
                        location_id TEXT PRIMARY KEY,
                        mean_frp REAL,
                        std_frp REAL,
                        days_active_30d INTEGER,
                        recurrence_rate REAL,
                        updated_at TEXT
                    )
                    """
                )
        except Exception:
            pass  # Fallback to in-memory if disk SQLite is restricted

    async def analyze_batch(self, hotspots: List[HotspotRaw]) -> BatchAnalysisResponse:
        """
        Executes the full 10-step AgniDrishti workflow on a batch of thermal hotspots.
        """
        if not hotspots:
            return BatchAnalysisResponse(
                total_hotspots=0,
                clusters_count=0,
                counts_by_classification={"INDUSTRIAL": 0, "NATURAL": 0, "UNCERTAIN": 0},
                counts_by_priority={"LOW": 0, "MEDIUM": 0, "HIGH": 0},
                clusters=[],
                results=[],
            )

        # Step 4: Spatial Clustering via DBSCAN
        clusters_list, point_to_cluster = self.clusterer.cluster_hotspots(hotspots)

        # Step 2: Asynchronous Context Enrichment (Facility lookup & land cover)
        enrichment_tasks = [self.enricher.enrich(h) for h in hotspots]
        enrichment_results = await asyncio.gather(*enrichment_tasks)

        analyzed_results: List[AgniDrishtiResult] = []

        for idx, hotspot in enumerate(hotspots):
            facility, land_cover = enrichment_results[idx]
            cluster = point_to_cluster.get(idx) or ClusterInfo(
                cluster_id=-1,
                size=1,
                total_frp=hotspot.frp,
                mean_frp=hotspot.frp,
                centroid_lat=hotspot.latitude,
                centroid_lon=hotspot.longitude,
                bbox=[hotspot.latitude, hotspot.longitude, hotspot.latitude, hotspot.longitude],
            )

            # Step 3: Historical baseline profile lookup
            baseline_profile = self.baseline_engine.find_baseline(hotspot.latitude, hotspot.longitude)

            # Step 5: Initial Source Classification
            cand_class, cand_conf = self.classifier.classify(
                hotspot=hotspot,
                facility=facility,
                land_cover=land_cover,
                cluster=cluster,
                baseline=baseline_profile,
            )

            # Step 6: Baseline Anomaly Check (If Industrial candidate)
            baseline_comp = self.baseline_engine.compare_with_baseline(
                hotspot=hotspot,
                facility=facility,
                is_industrial_candidate=(cand_class == ClassificationCategory.INDUSTRIAL),
            )

            # Step 7 & 8: Evidence Verification & Uncertainty Handling
            final_class, evidence_report = self.verifier.verify(
                candidate_class=cand_class,
                hotspot=hotspot,
                facility=facility,
                land_cover=land_cover,
                cluster=cluster,
                baseline=baseline_profile,
            )

            # Determine industrial status
            if final_class == ClassificationCategory.INDUSTRIAL:
                ind_status = baseline_comp.status
            else:
                ind_status = IndustrialStatus.NOT_APPLICABLE

            # Step 9: Priority Scoring
            priority_level, priority_reason = self.priority_engine.assign_priority(
                classification=final_class,
                industrial_status=ind_status,
                baseline_comp=baseline_comp,
                hotspot=hotspot,
                facility=facility,
                cluster=cluster,
                evidence=evidence_report,
            )

            # Parse timestamp
            acq_dt = parse_datetime(hotspot.acq_date, hotspot.acq_time)
            hotspot_id = hotspot.hotspot_id or f"hs-{idx}-{hotspot.latitude:.4f}-{hotspot.longitude:.4f}"

            # Step 10: Format GeoJSON feature for GIS Dashboard
            geojson_feat = self._create_geojson_feature(
                hotspot_id=hotspot_id,
                hotspot=hotspot,
                acq_dt=acq_dt,
                classification=final_class,
                ind_status=ind_status,
                priority=priority_level,
                priority_reason=priority_reason,
                facility=facility,
                cluster=cluster,
                evidence_summary=evidence_report.summary,
            )

            result = AgniDrishtiResult(
                id=hotspot_id,
                latitude=hotspot.latitude,
                longitude=hotspot.longitude,
                acq_datetime=acq_dt,
                frp=hotspot.frp,
                confidence=hotspot.confidence,
                daynight=hotspot.daynight,
                satellite=hotspot.satellite,
                cluster=cluster,
                nearest_facility=facility,
                land_cover=land_cover,
                baseline_comparison=baseline_comp,
                classification=final_class,
                industrial_status=ind_status,
                classification_confidence=cand_conf,
                priority=priority_level,
                priority_reason=priority_reason,
                evidence_report=evidence_report,
                geojson_feature=geojson_feat,
            )
            analyzed_results.append(result)

        # Compute summary counts
        counts_class = {"INDUSTRIAL": 0, "NATURAL": 0, "UNCERTAIN": 0}
        counts_priority = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}

        for r in analyzed_results:
            counts_class[r.classification.value] = counts_class.get(r.classification.value, 0) + 1
            counts_priority[r.priority.value] = counts_priority.get(r.priority.value, 0) + 1

        # Persist results in runtime cache and database
        save_hotspots(analyzed_results)

        return BatchAnalysisResponse(
            total_hotspots=len(analyzed_results),
            clusters_count=len(clusters_list),
            counts_by_classification=counts_class,
            counts_by_priority=counts_priority,
            clusters=clusters_list,
            results=analyzed_results,
        )

    def _create_geojson_feature(
        self,
        hotspot_id: str,
        hotspot: HotspotRaw,
        acq_dt: datetime,
        classification: ClassificationCategory,
        ind_status: IndustrialStatus,
        priority: PriorityLevel,
        priority_reason: str,
        facility: Optional[FacilityInfo],
        cluster: ClusterInfo,
        evidence_summary: str,
    ) -> Dict[str, Any]:
        """Generates RFC 7946 compliant GeoJSON feature styled for Leaflet/Mapbox maps."""
        # Color mapping by priority:
        # High = Red (#ef4444), Medium = Amber (#f59e0b), Low = Green (#10b981)
        priority_colors = {
            PriorityLevel.HIGH: "#ef4444",
            PriorityLevel.MEDIUM: "#f59e0b",
            PriorityLevel.LOW: "#10b981",
        }

        classification_badges = {
            ClassificationCategory.INDUSTRIAL: "🏭 Industrial",
            ClassificationCategory.NATURAL: "🌳 Natural/Agri",
            ClassificationCategory.UNCERTAIN: "❓ Uncertain",
        }

        color = priority_colors.get(priority, "#3b82f6")
        status_label = ind_status.value.replace("_", " ") if ind_status != IndustrialStatus.NOT_APPLICABLE else ""
        status_html = f"<p style='margin:2px 0; font-size:12px;'><b>Status:</b> {status_label}</p>" if status_label else ""

        popup_html = (
            f"<div style='font-family:sans-serif; min-width:200px;'>"
            f"<h4 style='margin:0 0 4px 0; color:{color}; font-size:14px; font-weight:bold;'>"
            f"{priority.value} PRIORITY &bull; {classification_badges.get(classification, classification.value)}</h4>"
            f"{status_html}"
            f"<p style='margin:2px 0; font-size:12px;'><b>FRP:</b> {hotspot.frp:.1f} MW</p>"
            f"<p style='margin:2px 0; font-size:12px;'><b>Facility:</b> {facility.name if facility else 'None within buffer'}</p>"
            f"<p style='margin:2px 0; font-size:12px;'><b>Cluster:</b> {cluster.size} point(s), {cluster.total_frp:.1f} MW total</p>"
            f"<p style='margin:4px 0 0 0; font-size:11px; color:#4b5563;'>{priority_reason}</p>"
            f"</div>"
        )

        return {
            "type": "Feature",
            "id": hotspot_id,
            "geometry": {
                "type": "Point",
                "coordinates": [hotspot.longitude, hotspot.latitude],
            },
            "properties": {
                "id": hotspot_id,
                "frp": hotspot.frp,
                "confidence": hotspot.confidence,
                "acq_datetime": acq_dt.isoformat(),
                "classification": classification.value,
                "industrial_status": ind_status.value,
                "priority": priority.value,
                "priority_reason": priority_reason,
                "facility_name": facility.name if facility else None,
                "facility_distance_m": facility.distance_meters if facility else None,
                "facility_hazardous": facility.is_hazardous if facility else False,
                "cluster_id": cluster.cluster_id,
                "cluster_size": cluster.size,
                "marker_color": color,
                "popup_html": popup_html,
                "evidence_summary": evidence_summary,
            },
        }
