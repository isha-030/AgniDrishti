"""
test_agnidrishti.py - Automated test suite for AgniDrishti thermal hotspot pipeline.
Tests ingestion, DBSCAN clustering, baseline anomaly detection (Case A vs Case B),
source classification, evidence verification, priority scoring, and FastAPI endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from baseline import BaselineEngine
from classifier import SourceClassifier
from clustering import SpatialClusterer
from enrichment import ContextEnricher
from evidence import EvidenceVerifier
from firms_client import FirmsClient
from hotspots import (
    ClassificationCategory,
    IndustrialStatus,
    PriorityLevel,
)
from ingest import IngestionEngine
from main import app
from pipeline import AgniDrishtiPipeline


client = TestClient(app)


def test_ingestion_csv_and_json():
    csv_data = """latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,frp,daynight
19.0125,72.8985,388.0,0.4,0.4,2026-09-21,0220,SNPP,high,350.5,N
22.3842,69.8512,342.5,0.4,0.4,2026-09-21,0215,SNPP,nominal,84.2,N
"""
    hotspots = IngestionEngine.from_csv_text(csv_data)
    assert len(hotspots) == 2
    assert hotspots[0].latitude == 19.0125
    assert hotspots[0].frp == 350.5
    assert hotspots[1].frp == 84.2


def test_spatial_clustering_dbscan():
    """Points within 1 km should be clustered together into 1 cluster."""
    demo_pts = FirmsClient.get_demo_hotspots()
    clusterer = SpatialClusterer(eps_km=1.0, min_samples=1)
    clusters, point_to_cluster = clusterer.cluster_hotspots(demo_pts)

    assert len(clusters) > 0
    # Detections 2, 3, 4 are around Mahul refinery (within ~300m of each other)
    cluster_mahul = point_to_cluster[1]
    assert cluster_mahul.size >= 3
    assert cluster_mahul.total_frp > 500.0


import asyncio

def test_case_a_normal_industrial_baseline():
    """Case A: Jamnagar Refinery routine flare (FRP 84.2 vs baseline ~82.4 MW -> KNOWN_EXPECTED, LOW priority)"""
    async def _run():
        pipeline = AgniDrishtiPipeline()
        hotspot = FirmsClient.get_demo_hotspots()[0]  # Jamnagar

        response = await pipeline.analyze_batch([hotspot])
        assert response.total_hotspots == 1
        res = response.results[0]

        assert res.classification == ClassificationCategory.INDUSTRIAL
        assert res.industrial_status == IndustrialStatus.KNOWN_EXPECTED
        assert res.priority == PriorityLevel.LOW
        assert "Routine Activity" in res.priority_reason or "Normal" in res.priority_reason
        assert res.baseline_comparison.z_score is not None
        assert abs(res.baseline_comparison.z_score) < 2.0

    asyncio.run(_run())


def test_case_b_anomalous_industrial_spike():
    """Case B: Mumbai Mahul Refinery spike (FRP 350.5 vs baseline ~81.2 MW -> NEW_ANOMALOUS, HIGH priority)"""
    async def _run():
        pipeline = AgniDrishtiPipeline()
        hotspot = FirmsClient.get_demo_hotspots()[1]  # Mumbai spike

        response = await pipeline.analyze_batch([hotspot])
        assert response.total_hotspots == 1
        res = response.results[0]

        assert res.classification == ClassificationCategory.INDUSTRIAL
        assert res.industrial_status == IndustrialStatus.NEW_ANOMALOUS
        assert res.priority == PriorityLevel.HIGH
        assert res.baseline_comparison.frp_ratio is not None
        assert res.baseline_comparison.frp_ratio > 3.0
        assert "CRITICAL ANOMALY" in res.priority_reason or "HIGH" in res.priority_reason

    asyncio.run(_run())


def test_natural_forest_and_agri_fires():
    """Natural forest fire and agricultural stubble burning should classify as NATURAL."""
    async def _run():
        pipeline = AgniDrishtiPipeline()
        demo_pts = FirmsClient.get_demo_hotspots()
        forest_fire = demo_pts[4]  # Nilgiris
        agri_fire = demo_pts[6]    # Ludhiana

        response = await pipeline.analyze_batch([forest_fire, agri_fire])
        assert response.total_hotspots == 2
        for r in response.results:
            assert r.classification == ClassificationCategory.NATURAL
            assert r.industrial_status == IndustrialStatus.NOT_APPLICABLE

    asyncio.run(_run())


def test_uncertain_detection_handling():
    """Ambiguous detection with conflicting evidence should be flagged as UNCERTAIN."""
    async def _run():
        pipeline = AgniDrishtiPipeline()
        uncertain_pt = FirmsClient.get_demo_hotspots()[7]  # Pune transition zone

        response = await pipeline.analyze_batch([uncertain_pt])
        res = response.results[0]
        assert res.classification == ClassificationCategory.UNCERTAIN
        assert res.priority in (PriorityLevel.MEDIUM, PriorityLevel.LOW)
        assert res.evidence_report.has_conflicts or "UNCERTAIN" in res.evidence_report.summary

    asyncio.run(_run())


def test_api_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_api_demo_endpoint():
    response = client.get("/api/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["total_hotspots"] == 8
    assert "INDUSTRIAL" in data["counts_by_classification"]
    assert "NATURAL" in data["counts_by_classification"]
    assert "UNCERTAIN" in data["counts_by_classification"]
    assert data["counts_by_priority"]["HIGH"] >= 1
    assert data["counts_by_priority"]["LOW"] >= 1


def test_api_geojson_endpoint():
    response = client.get("/api/hotspots/geojson?use_demo=true")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 8
    for feat in data["features"]:
        assert feat["type"] == "Feature"
        assert feat["geometry"]["type"] == "Point"
        assert "marker_color" in feat["properties"]
        assert "popup_html" in feat["properties"]
        assert "priority" in feat["properties"]


def test_api_clusters_endpoint():
    response = client.get("/api/clusters")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert data["cluster_count"] > 0


def test_api_hotspots_router_endpoints():
    # First ensure demo data is loaded
    client.get("/api/demo")
    
    # Query /api/hotspots
    resp = client.get("/api/hotspots")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert data["count"] > 0
    assert len(data["features"]) > 0

    # Query with priority filter
    resp_high = client.get("/api/hotspots?priority=HIGH")
    assert resp_high.status_code == 200
    data_high = resp_high.json()
    for feat in data_high["features"]:
        assert feat["properties"]["priority"] == "HIGH"

    # Query /api/hotspots/summary
    resp_sum = client.get("/api/hotspots/summary")
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    assert sum_data["total"] > 0
    assert "HIGH" in sum_data["by_priority"]

