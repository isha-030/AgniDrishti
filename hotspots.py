"""
hotspots.py - Core data models, schemas, and API router for AgniDrishti.
Defines Pydantic models for raw hotspots, spatial enrichment, baseline comparisons,
classification categories, evidence reports, priority rankings, and GeoJSON features,
as well as the /api/hotspots GIS endpoints.
"""

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from database import load_hotspots


class ClassificationCategory(str, Enum):
    INDUSTRIAL = "INDUSTRIAL"
    NATURAL = "NATURAL"
    UNCERTAIN = "UNCERTAIN"


class IndustrialStatus(str, Enum):
    KNOWN_EXPECTED = "KNOWN_EXPECTED"
    NEW_ANOMALOUS = "NEW_ANOMALOUS"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class PriorityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class LandCoverType(str, Enum):
    BUILT_UP_INDUSTRIAL = "BUILT_UP_INDUSTRIAL"
    FOREST = "FOREST"
    AGRICULTURE = "AGRICULTURE"
    SHRUBLAND = "SHRUBLAND"
    WATER = "WATER"
    URBAN_RESIDENTIAL = "URBAN_RESIDENTIAL"
    OTHER = "OTHER"


class HotspotRaw(BaseModel):
    """Raw thermal hotspot detection from NASA FIRMS or user input."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    acq_date: Optional[str] = Field(None, description="Acquisition date (YYYY-MM-DD)")
    acq_time: Optional[str] = Field(None, description="Acquisition time (HHMM, UTC)")
    frp: float = Field(0.0, ge=0.0, description="Fire Radiative Power in Megawatts (MW)")
    confidence: Optional[str | float] = Field(None, description="Detection confidence percentage (0-100) or nominal/low/high")
    brightness: Optional[float] = Field(None, description="Brightness temperature in Kelvin (MODIS/VIIRS)")
    bright_ti4: Optional[float] = Field(None, description="VIIRS I-4 brightness temp (Kelvin)")
    bright_ti5: Optional[float] = Field(None, description="VIIRS I-5 brightness temp (Kelvin)")
    scan: Optional[float] = Field(None, description="Along-scan pixel size")
    track: Optional[float] = Field(None, description="Along-track pixel size")
    satellite: Optional[str] = Field(None, description="Satellite name (e.g. SNPP, NOAA-20, Aqua, Terra)")
    instrument: Optional[str] = Field(None, description="Instrument (VIIRS, MODIS)")
    daynight: Optional[str] = Field(None, description="'D' for Day, 'N' for Night")
    hotspot_id: Optional[str] = Field(None, description="Unique identifier if provided")

    @property
    def lat(self) -> float:
        return self.latitude

    @property
    def lon(self) -> float:
        return self.longitude


# Alias for compatibility with earlier scripts
RawHotspot = HotspotRaw


class FacilityInfo(BaseModel):
    """Information regarding nearby industrial infrastructure derived from OSM/registry."""
    osm_id: Optional[str] = None
    name: str = "Unknown Facility"
    facility_type: str = "industrial"  # e.g. refinery, power_plant, steelworks, chemical, factory
    distance_meters: float = Field(..., description="Geodesic distance to hotspot in meters")
    is_hazardous: bool = False
    tags: Dict[str, str] = Field(default_factory=dict)


class LandCoverContext(BaseModel):
    """Contextual classification of the surrounding land cover."""
    dominant_type: LandCoverType = LandCoverType.OTHER
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    description: str = "Unknown land cover"
    source: str = "OSM/LandCover Model"


class BaselineProfile(BaseModel):
    """Historical site-specific thermal baseline for a recurring location/facility."""
    location_id: str
    sample_count: int = 0
    historical_days_active_30d: int = 0
    recurrence_rate: float = 0.0  # 0.0 to 1.0 (e.g. 28/30 = 0.93)
    mean_frp: float = 0.0
    std_frp: float = 0.0
    median_frp: float = 0.0
    min_frp: float = 0.0
    max_frp: float = 0.0
    day_detection_ratio: float = 0.5
    is_known_recurring: bool = False


class BaselineComparison(BaseModel):
    """Comparison of current detection against site-specific historical baseline."""
    current_frp: float
    baseline_mean_frp: Optional[float] = None
    baseline_std_frp: Optional[float] = None
    frp_ratio: Optional[float] = None  # current_frp / baseline_mean_frp
    z_score: Optional[float] = None     # (current_frp - mean) / std
    status: IndustrialStatus = IndustrialStatus.NOT_APPLICABLE
    explanation: str = "No baseline data available for comparison."


class EvidenceItem(BaseModel):
    """Individual piece of supporting or counter evidence."""
    factor: str
    signal: str = "SUPPORT"  # "SUPPORT", "COUNTER", "NEUTRAL"
    weight: float = 1.0
    description: str


class EvidenceReport(BaseModel):
    """Comprehensive evidence compilation verifying the final classification."""
    supporting_evidence: List[EvidenceItem] = Field(default_factory=list)
    counter_evidence: List[EvidenceItem] = Field(default_factory=list)
    net_score: float = 0.0
    has_conflicts: bool = False
    summary: str = ""


class ClusterInfo(BaseModel):
    """Spatial cluster summary from DBSCAN grouping."""
    cluster_id: int = -1  # -1 indicates noise/single point
    size: int = 1
    total_frp: float = 0.0
    mean_frp: float = 0.0
    centroid_lat: float
    centroid_lon: float
    bbox: List[float] = Field(default_factory=list)  # [min_lat, min_lon, max_lat, max_lon]


class AgniDrishtiResult(BaseModel):
    """Complete analyzed hotspot output with context, baseline, evidence, priority, and GIS formatting."""
    id: str
    latitude: float
    longitude: float
    acq_datetime: datetime
    frp: float
    confidence: Optional[str | float] = None
    daynight: Optional[str] = None
    satellite: Optional[str] = None
    cluster: ClusterInfo
    nearest_facility: Optional[FacilityInfo] = None
    land_cover: LandCoverContext
    baseline_comparison: BaselineComparison
    classification: ClassificationCategory
    industrial_status: IndustrialStatus = IndustrialStatus.NOT_APPLICABLE
    classification_confidence: float = Field(0.5, ge=0.0, le=1.0)
    priority: PriorityLevel
    priority_reason: str
    evidence_report: EvidenceReport
    geojson_feature: Dict[str, Any] = Field(default_factory=dict)


class BatchAnalysisRequest(BaseModel):
    hotspots: List[HotspotRaw] = Field(..., description="List of raw hotspot detections")


class BatchAnalysisResponse(BaseModel):
    total_hotspots: int
    clusters_count: int
    counts_by_classification: Dict[str, int]
    counts_by_priority: Dict[str, int]
    clusters: List[ClusterInfo]
    results: List[AgniDrishtiResult]


# --- APIRouter for GIS Hotspots Dashboard ---
router = APIRouter(prefix="/api", tags=["hotspots"])


@router.get("/hotspots")
def get_hotspots(
    priority: Optional[str] = Query(None, description="Filter: LOW, MEDIUM, HIGH"),
    source_type: Optional[str] = Query(None, description="Filter: INDUSTRIAL, NATURAL, UNCERTAIN"),
):
    """
    Returns classified hotspots as GeoJSON - ready to drop straight into a
    React + Leaflet map on the frontend.
    """
    hotspots = load_hotspots()

    if priority:
        hotspots = [h for h in hotspots if h.priority == priority.upper()]
    if source_type:
        hotspots = [h for h in hotspots if h.source_type == source_type.upper()]

    features = []
    for h in hotspots:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [h.lon, h.lat]},
            "properties": h.dict(exclude={"lat", "lon"}),
        })

    return {"type": "FeatureCollection", "features": features, "count": len(features)}


@router.get("/hotspots/summary")
def get_summary():
    """Quick counts for a dashboard header/stat cards."""
    hotspots = load_hotspots()
    summary = {
        "total": len(hotspots),
        "by_priority": {"HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "by_source_type": {"INDUSTRIAL": 0, "NATURAL": 0, "UNCERTAIN": 0},
    }
    for h in hotspots:
        prio = str(h.priority).upper()
        summary["by_priority"][prio] = summary["by_priority"].get(prio, 0) + 1
        st = str(h.source_type).upper()
        summary["by_source_type"][st] = summary["by_source_type"].get(st, 0) + 1
    return summary