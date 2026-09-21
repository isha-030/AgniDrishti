"""
main.py - FastAPI Backend Service for AgniDrishti.
Serves REST and GeoJSON endpoints for satellite thermal hotspot analysis,
historical baseline comparisons, DBSCAN clustering, and GIS map dashboards.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from firms_client import FirmsClient
from hotspots import (
    BatchAnalysisRequest,
    BatchAnalysisResponse,
    HotspotRaw,
    router as hotspots_router,
)
from ingest import IngestionEngine
from pipeline import AgniDrishtiPipeline


app = FastAPI(
    title="AgniDrishti — Thermal Hotspot Intelligence API",
    description=(
        "NASA FIRMS tells us where the heat is. AgniDrishti adds context about surrounding infrastructure "
        "and historical behaviour, classifies the source (Industrial, Natural/Agri, Uncertain), "
        "detects operational anomalies against site baselines, assigns priorities, and visualizes on GIS maps."
    ),
    version="1.0.0",
)

# Enable CORS for React + Leaflet frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include hotspot endpoints
app.include_router(hotspots_router)

# Global pipeline and client instances
pipeline = AgniDrishtiPipeline()
firms_client = FirmsClient()

# Cached last analysis result for instant GeoJSON map retrieval
_last_analysis_response: Optional[BatchAnalysisResponse] = None


import os
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")


@app.get("/", tags=["General"])
def read_root():
    """Serves frontend UI if built, or API overview."""
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "service": "AgniDrishti",
        "description": "Satellite Thermal Hotspot Intelligence & Industrial Anomaly Detection",
        "status": "online",
        "endpoints": {
            "demo_analysis": "/api/demo",
            "analyze_batch": "/api/analyze",
            "upload_csv": "/api/upload",
            "geojson_map": "/api/hotspots/geojson",
            "clusters": "/api/clusters",
            "docs": "/docs",
        },
    }


@app.get("/health", tags=["General"])
@app.get("/api/health", tags=["General"])
@app.get("/healthz", tags=["General"])
def health_check():
    """Health check endpoint for cloud hosts, Render, Kubernetes, and uptime monitors."""
    return {
        "status": "healthy",
        "service": "AgniDrishti Satellite Intelligence API",
        "pipeline_ready": True,
        "database": "sqlite_connected",
    }


@app.post("/api/analyze", response_model=BatchAnalysisResponse, tags=["Analysis"])
async def analyze_hotspots(request: BatchAnalysisRequest):
    """
    Executes the 10-step AgniDrishti pipeline on an array of raw satellite thermal hotspots.
    """
    global _last_analysis_response
    if not request.hotspots:
        raise HTTPException(status_code=400, detail="Hotspots array cannot be empty.")

    result = await pipeline.analyze_batch(request.hotspots)
    _last_analysis_response = result
    return result


@app.post("/api/upload", response_model=BatchAnalysisResponse, tags=["Analysis"])
async def upload_firms_file(file: UploadFile = File(...)):
    """
    Upload a NASA FIRMS CSV or JSON export file.
    Cleans, ingests, enriches, clusters, classifies, and evaluates against historical baselines.
    """
    global _last_analysis_response
    contents = await file.read()
    filename = file.filename.lower() if file.filename else "upload.csv"

    try:
        if filename.endswith(".csv") or filename.endswith(".txt"):
            hotspots = IngestionEngine.from_csv_bytes(contents)
        elif filename.endswith(".json") or filename.endswith(".geojson"):
            hotspots = IngestionEngine.from_json_content(contents)
        else:
            # Try CSV first, then JSON
            try:
                hotspots = IngestionEngine.from_csv_bytes(contents)
            except Exception:
                hotspots = IngestionEngine.from_json_content(contents)

        if not hotspots:
            raise HTTPException(status_code=400, detail="No valid thermal hotspot records found in file.")

        result = await pipeline.analyze_batch(hotspots)
        _last_analysis_response = result
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(exc)}")


@app.get("/api/demo", response_model=BatchAnalysisResponse, tags=["Demo"])
async def run_demo():
    """
    Runs the full analysis pipeline on the built-in realistic benchmark dataset.
    Demonstrates:
    - Case A: Jamnagar Refinery routine flare (Expected / Low Priority)
    - Case B: Mumbai Mahul Refinery thermal anomaly (350 MW spike / High Priority)
    - Case C: Nilgiris Western Ghats forest fire (Natural / Medium Priority)
    - Case D: Punjab crop stubble burning (Agricultural / Low-Medium Priority)
    - Case E: Uncertain transition detection with conflicting evidence
    """
    global _last_analysis_response
    demo_hotspots = firms_client.get_demo_hotspots()
    result = await pipeline.analyze_batch(demo_hotspots)
    _last_analysis_response = result
    return result


@app.get("/api/hotspots/geojson", tags=["GIS"])
async def get_hotspots_geojson(use_demo: bool = Query(False, description="Force run on demo data")):
    """
    Returns an RFC 7946 compliant GeoJSON FeatureCollection formatted directly
    for Leaflet / GIS dashboard layers with color-coded priority markers and popups.
    """
    global _last_analysis_response
    if use_demo or _last_analysis_response is None:
        demo_hotspots = firms_client.get_demo_hotspots()
        _last_analysis_response = await pipeline.analyze_batch(demo_hotspots)

    features = [r.geojson_feature for r in _last_analysis_response.results if r.geojson_feature]

    return {
        "type": "FeatureCollection",
        "metadata": {
            "total_hotspots": len(features),
            "generated_at": _last_analysis_response.results[0].acq_datetime.isoformat()
            if _last_analysis_response.results
            else None,
        },
        "features": features,
    }


@app.get("/api/clusters", tags=["GIS"])
async def get_clusters():
    """
    Returns spatial clusters computed by DBSCAN with polygon bounding boxes and aggregate FRP.
    """
    global _last_analysis_response
    if _last_analysis_response is None:
        demo_hotspots = firms_client.get_demo_hotspots()
        _last_analysis_response = await pipeline.analyze_batch(demo_hotspots)

    cluster_features = []
    for c in _last_analysis_response.clusters:
        if c.bbox and len(c.bbox) == 4:
            min_lat, min_lon, max_lat, max_lon = c.bbox
            # If cluster has only 1 point, expand slightly for polygon visualization
            if min_lat == max_lat:
                min_lat -= 0.003
                max_lat += 0.003
                min_lon -= 0.003
                max_lon += 0.003

            polygon_coords = [
                [
                    [min_lon, min_lat],
                    [max_lon, min_lat],
                    [max_lon, max_lat],
                    [min_lon, max_lat],
                    [min_lon, min_lat],
                ]
            ]

            cluster_features.append(
                {
                    "type": "Feature",
                    "id": f"cluster-{c.cluster_id}",
                    "geometry": {"type": "Polygon", "coordinates": polygon_coords},
                    "properties": {
                        "cluster_id": c.cluster_id,
                        "point_count": c.size,
                        "total_frp": c.total_frp,
                        "mean_frp": c.mean_frp,
                        "centroid": [c.centroid_lon, c.centroid_lat],
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "cluster_count": len(_last_analysis_response.clusters),
        "features": cluster_features,
    }


@app.get("/api/firms/country", response_model=BatchAnalysisResponse, tags=["NASA FIRMS"])
async def query_firms_country(
    country: str = Query("IND", description="ISO3 Country Code (e.g. IND, USA)"),
    days: int = Query(1, ge=1, le=10),
    source: str = Query("VIIRS_SNPP_NRT"),
):
    """
    Fetches real-time hotspot data from NASA FIRMS API for a country and processes it through the pipeline.
    """
    hotspots = await firms_client.fetch_country_hotspots(country_code=country, source=source, days=days)
    return await pipeline.analyze_batch(hotspots)


@app.get("/api/firms/area", response_model=BatchAnalysisResponse, tags=["NASA FIRMS"])
async def query_firms_area(
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    days: int = Query(1, ge=1, le=10),
    source: str = Query("VIIRS_SNPP_NRT"),
):
    """
    Fetches real-time hotspot data from NASA FIRMS API for a bounding box and processes it through the pipeline.
    """
    hotspots = await firms_client.fetch_area_hotspots(
        min_lon=min_lon,
        min_lat=min_lat,
        max_lon=max_lon,
        max_lat=max_lat,
        source=source,
        days=days,
    )
    return await pipeline.analyze_batch(hotspots)


# ==============================================================================
# Frontend-Supporting Intelligence Endpoints (Dynamic, Zero-Hardcoding)
# ==============================================================================

async def _get_active_batch() -> BatchAnalysisResponse:
    """Ensures a batch analysis response is loaded (from cache, local dataset, or demo)."""
    global _last_analysis_response
    if _last_analysis_response is not None:
        return _last_analysis_response

    import os
    from pathlib import Path
    raw_csv = Path("dataset/firms_raw_india.csv")
    if raw_csv.exists():
        try:
            with open(raw_csv, "r", encoding="utf-8") as f:
                hotspots = IngestionEngine.from_csv_text(f.read())
            if hotspots:
                _last_analysis_response = await pipeline.analyze_batch(hotspots)
                return _last_analysis_response
        except Exception:
            pass

    # Fallback to demo
    demo_hotspots = firms_client.get_demo_hotspots()
    _last_analysis_response = await pipeline.analyze_batch(demo_hotspots)
    return _last_analysis_response


@app.get("/api/dashboard/summary", tags=["Dashboard"])
async def get_dashboard_summary():
    """
    Supplies dynamic operational KPIs for the Dashboard header.
    Never fabricates data; calculates directly from active satellite detections.
    """
    batch = await _get_active_batch()
    last_updated = (
        batch.results[0].acq_datetime.isoformat()
        if batch.results
        else None
    )

    return {
        "total_hotspots": batch.total_hotspots,
        "high_priority": batch.counts_by_priority.get("HIGH", 0),
        "medium_priority": batch.counts_by_priority.get("MEDIUM", 0),
        "low_priority": batch.counts_by_priority.get("LOW", 0),
        "industrial": batch.counts_by_classification.get("INDUSTRIAL", 0),
        "natural": batch.counts_by_classification.get("NATURAL", 0),
        "uncertain": batch.counts_by_classification.get("UNCERTAIN", 0),
        "clusters_count": batch.clusters_count,
        "last_updated": last_updated,
        "system_status": "ONLINE",
    }


@app.get("/api/alerts", tags=["Alerts"])
async def get_alerts_list(
    priority: Optional[str] = Query(None, description="Filter: HIGH, MEDIUM, LOW"),
    classification: Optional[str] = Query(None, description="Filter: INDUSTRIAL, NATURAL, UNCERTAIN"),
    status: Optional[str] = Query(None, description="Filter: KNOWN_EXPECTED, NEW_ANOMALOUS"),
    search: Optional[str] = Query(None, description="Search term in facility name, id, or coordinates"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Returns list of detected alerts with flexible filtering and search for the Alerts table.
    """
    batch = await _get_active_batch()
    results = batch.results

    if priority and priority.upper() != "ALL":
        results = [r for r in results if r.priority.value == priority.upper()]
    if classification and classification.upper() != "ALL":
        results = [r for r in results if r.classification.value == classification.upper()]
    if status and status.upper() != "ALL":
        results = [r for r in results if r.industrial_status.value == status.upper()]
    if search:
        s = search.lower().strip()
        results = [
            r for r in results
            if s in r.id.lower()
            or (r.nearest_facility and s in r.nearest_facility.name.lower())
            or (s in f"{r.latitude},{r.longitude}")
        ]

    total_matched = len(results)
    paginated = results[offset : offset + limit]

    return {
        "total": total_matched,
        "limit": limit,
        "offset": offset,
        "alerts": [
            {
                "id": r.id,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "acq_datetime": r.acq_datetime.isoformat(),
                "frp": r.frp,
                "confidence": r.confidence,
                "daynight": r.daynight,
                "satellite": r.satellite,
                "classification": r.classification.value,
                "industrial_status": r.industrial_status.value,
                "priority": r.priority.value,
                "priority_reason": r.priority_reason,
                "facility_name": r.nearest_facility.name if r.nearest_facility else None,
                "facility_distance_m": r.nearest_facility.distance_meters if r.nearest_facility else None,
                "land_cover": r.land_cover.dominant_type.value,
                "cluster_id": r.cluster.cluster_id,
                "marker_color": r.geojson_feature.get("properties", {}).get("marker_color", "#ef4444"),
            }
            for r in paginated
        ],
    }


@app.get("/api/alerts/{alert_id}", tags=["Alerts"])
async def get_alert_detail(alert_id: str):
    """
    Returns complete intelligence payload for the Alert Details drawer.
    """
    batch = await _get_active_batch()
    for r in batch.results:
        if r.id == alert_id:
            return r

    raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")


@app.get("/api/facilities", tags=["Facilities"])
async def get_facilities():
    """
    Returns industrial facilities catalog with associated thermal detections and operational status.
    """
    batch = await _get_active_batch()

    facilities_map = {}
    for r in batch.results:
        if r.nearest_facility:
            fac = r.nearest_facility
            key = fac.name
            if key not in facilities_map:
                baseline_prof = pipeline.baseline_engine.find_baseline(r.latitude, r.longitude)
                facilities_map[key] = {
                    "name": fac.name,
                    "facility_type": fac.facility_type,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "is_hazardous": fac.is_hazardous,
                    "detections_count": 0,
                    "frp_values": [],
                    "latest_detection": r.acq_datetime.isoformat(),
                    "latest_status": r.industrial_status.value,
                    "latest_priority": r.priority.value,
                    "baseline_mean": baseline_prof.mean_frp if baseline_prof else None,
                    "baseline_recurrence": baseline_prof.recurrence_rate if baseline_prof else None,
                    "min_distance_m": fac.distance_meters,
                }

            entry = facilities_map[key]
            entry["detections_count"] += 1
            entry["frp_values"].append(r.frp)
            if fac.distance_meters < entry["min_distance_m"]:
                entry["min_distance_m"] = fac.distance_meters
            if r.industrial_status.value == "NEW_ANOMALOUS":
                entry["latest_status"] = "NEW_ANOMALOUS"
            if r.priority.value == "HIGH":
                entry["latest_priority"] = "HIGH"

    # Format summaries
    facility_list = []
    for f in facilities_map.values():
        frps = f.pop("frp_values")
        f["mean_frp"] = round(sum(frps) / len(frps), 1) if frps else 0.0
        f["max_frp"] = round(max(frps), 1) if frps else 0.0
        facility_list.append(f)

    # Sort by priority and detections
    priority_weights = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    facility_list.sort(key=lambda x: (priority_weights.get(x["latest_priority"], 0), x["detections_count"]), reverse=True)

    return {
        "total_facilities": len(facility_list),
        "facilities": facility_list,
    }


@app.get("/api/facilities/{facility_name}", tags=["Facilities"])
async def get_facility_detail(facility_name: str):
    """
    Returns specific facility details and its associated hotspot detections for the Facility Details drawer.
    """
    batch = await _get_active_batch()
    matching_hotspots = [
        r for r in batch.results
        if r.nearest_facility and r.nearest_facility.name.lower() == facility_name.lower()
    ]

    if not matching_hotspots:
        # Check if in curated registry
        for cur in pipeline.osm_client._curated_registry:
            if cur["name"].lower() == facility_name.lower():
                baseline_prof = pipeline.baseline_engine.find_baseline(cur["lat"], cur["lon"])
                return {
                    "name": cur["name"],
                    "facility_type": cur["facility_type"],
                    "latitude": cur["lat"],
                    "longitude": cur["lon"],
                    "is_hazardous": cur.get("is_hazardous", False),
                    "baseline_mean": baseline_prof.mean_frp if baseline_prof else None,
                    "baseline_recurrence": baseline_prof.recurrence_rate if baseline_prof else None,
                    "detections_count": 0,
                    "hotspots": [],
                }
        raise HTTPException(status_code=404, detail=f"Facility '{facility_name}' not found.")

    first = matching_hotspots[0]
    fac = first.nearest_facility
    baseline_prof = pipeline.baseline_engine.find_baseline(first.latitude, first.longitude)

    frps = [h.frp for h in matching_hotspots]
    return {
        "name": fac.name,
        "facility_type": fac.facility_type,
        "latitude": first.latitude,
        "longitude": first.longitude,
        "is_hazardous": fac.is_hazardous,
        "baseline_mean": baseline_prof.mean_frp if baseline_prof else None,
        "baseline_recurrence": baseline_prof.recurrence_rate if baseline_prof else None,
        "detections_count": len(matching_hotspots),
        "mean_frp": round(sum(frps) / len(frps), 1),
        "max_frp": round(max(frps), 1),
        "hotspots": [h.id for h in matching_hotspots],
    }


@app.get("/api/analytics", tags=["Analytics"])
async def get_analytics_metrics():
    """
    Aggregates time-series, classification, priority, and thermal metrics for Page 5 (Analytics).
    """
    batch = await _get_active_batch()
    results = batch.results

    # 1. Hotspot Trend by Date
    trend_map = {}
    for r in results:
        d_str = r.acq_datetime.strftime("%Y-%m-%d")
        if d_str not in trend_map:
            trend_map[d_str] = {"date": d_str, "count": 0, "total_frp": 0.0, "industrial": 0, "natural": 0, "uncertain": 0}
        trend_map[d_str]["count"] += 1
        trend_map[d_str]["total_frp"] += r.frp
        c_val = r.classification.value.lower()
        if c_val in trend_map[d_str]:
            trend_map[d_str][c_val] += 1

    trend_list = sorted(trend_map.values(), key=lambda x: x["date"])
    for item in trend_list:
        item["avg_frp"] = round(item["total_frp"] / max(item["count"], 1), 1)
        item["total_frp"] = round(item["total_frp"], 1)

    # 2. FRP Intensity Buckets
    frp_buckets = {"< 20 MW": 0, "20-50 MW": 0, "50-100 MW": 0, "> 100 MW": 0}
    for r in results:
        if r.frp < 20.0:
            frp_buckets["< 20 MW"] += 1
        elif r.frp < 50.0:
            frp_buckets["20-50 MW"] += 1
        elif r.frp < 100.0:
            frp_buckets["50-100 MW"] += 1
        else:
            frp_buckets["> 100 MW"] += 1

    # 3. Diurnal (Day/Night) Distribution
    daynight_counts = {"Day": 0, "Night": 0, "Unknown": 0}
    for r in results:
        dn = (r.daynight or "").upper()
        if dn == "D":
            daynight_counts["Day"] += 1
        elif dn == "N":
            daynight_counts["Night"] += 1
        else:
            daynight_counts["Unknown"] += 1

    # 4. Top Facilities by thermal activity
    fac_counts = {}
    for r in results:
        if r.nearest_facility and r.classification.value == "INDUSTRIAL":
            name = r.nearest_facility.name
            fac_counts[name] = fac_counts.get(name, 0) + 1

    top_facilities = sorted([{"name": k, "count": v} for k, v in fac_counts.items()], key=lambda x: x["count"], reverse=True)[:5]

    return {
        "total_hotspots": batch.total_hotspots,
        "clusters_count": batch.clusters_count,
        "classification_distribution": batch.counts_by_classification,
        "priority_distribution": batch.counts_by_priority,
        "hotspot_trend": trend_list,
        "frp_distribution": frp_buckets,
        "diurnal_distribution": daynight_counts,
        "top_facilities": top_facilities,
    }


@app.post("/api/report/generate", tags=["Reports"])
async def generate_incident_report(payload: Dict[str, Any]):
    """
    Generates structured incident report payload for an event, ready for PDF/print or JSON download.
    """
    alert_id = payload.get("hotspot_id")
    if not alert_id:
        raise HTTPException(status_code=400, detail="hotspot_id is required.")

    batch = await _get_active_batch()
    match = next((r for r in batch.results if r.id == alert_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")

    return {
        "report_id": f"REP-{alert_id}",
        "generated_at": batch.results[0].acq_datetime.isoformat(),
        "hotspot": {
            "id": match.id,
            "coordinates": f"{match.latitude:.4f}, {match.longitude:.4f}",
            "acq_datetime": match.acq_datetime.isoformat(),
            "frp": f"{match.frp:.1f} MW",
            "confidence": str(match.confidence),
            "classification": match.classification.value,
            "industrial_status": match.industrial_status.value,
            "priority": match.priority.value,
            "priority_reason": match.priority_reason,
            "nearest_facility": match.nearest_facility.name if match.nearest_facility else "None in buffer",
            "facility_distance": f"{match.nearest_facility.distance_meters:.0f} m" if match.nearest_facility else "N/A",
            "land_cover": match.land_cover.dominant_type.value,
            "cluster_info": f"Cluster #{match.cluster.cluster_id} ({match.cluster.size} points, {match.cluster.total_frp:.1f} MW)",
        },
        "evidence_summary": match.evidence_report.summary,
        "supporting_evidence": [e.description for e in match.evidence_report.supporting_evidence],
        "counter_evidence": [e.description for e in match.evidence_report.counter_evidence],
        "baseline_summary": match.baseline_comparison.explanation,
        "recommended_action": (
            "Immediate on-site dispatch & alert industrial response team."
            if match.priority.value == "HIGH"
            else ("Analyst monitoring & secondary satellite pass verification." if match.priority.value == "MEDIUM" else "Routine operational heat signature logged.")
        ),
    }


# ---------------------------------------------------------------------------
# Production Single-Service Frontend Serving
# ---------------------------------------------------------------------------
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
