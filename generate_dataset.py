"""
generate_dataset.py - Generates, processes, and persists satellite thermal hotspot dataset
using the live NASA FIRMS API key.
Saves:
- dataset/firms_raw_india.csv
- dataset/firms_raw_india.json
- dataset/agnidrishti_analyzed_dataset.json
- dataset/agnidrishti_analyzed_geojson.json
"""

import asyncio
import json
import os
from pathlib import Path
import httpx
from database import save_hotspots
from ingest import IngestionEngine
from pipeline import AgniDrishtiPipeline


FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "e42c93c1a159a5843db4438d20814b7a")
OUTPUT_DIR = Path("dataset")


async def fetch_firms_data(source: str, days: int = 3, bbox: str = "68,6,98,36") -> str:
    """Queries NASA FIRMS area API for satellite thermal detections."""
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/{source}/{bbox}/{days}"
    print(f"[*] Fetching live data from NASA FIRMS ({source}, {days} days)...")
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 70)
    print(" AgniDrishti — Live NASA FIRMS Dataset Generator")
    print("=" * 70)
    print(f"API Key: {FIRMS_MAP_KEY[:6]}...{FIRMS_MAP_KEY[-4:]}")

    # 1. Fetch from SNPP and NOAA-20 VIIRS instruments
    raw_texts = []
    for src in ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]:
        try:
            csv_text = await fetch_firms_data(source=src, days=3)
            raw_texts.append(csv_text)
            lines_count = len([l for l in csv_text.splitlines() if l.strip()]) - 1
            print(f"[+] Successfully retrieved {lines_count} detections from {src}")
        except Exception as err:
            print(f"[-] Warning: Failed to fetch from {src}: {err}")

    if not raw_texts:
        print("[-] Error: No data could be fetched from NASA FIRMS.")
        return

    # 2. Parse & Ingest
    hotspots = []
    for t in raw_texts:
        pts = IngestionEngine.from_csv_text(t)
        hotspots.extend(pts)

    # Deduplicate points with identical (lat, lon, acq_date, acq_time)
    seen = set()
    deduped_hotspots = []
    for h in hotspots:
        key = (round(h.latitude, 4), round(h.longitude, 4), str(h.acq_date), str(h.acq_time))
        if key not in seen:
            seen.add(key)
            deduped_hotspots.append(h)

    print(f"[+] Total unique satellite hotspots compiled: {len(deduped_hotspots)}")

    # 3. Save Raw Dataset (CSV & JSON)
    raw_csv_path = OUTPUT_DIR / "firms_raw_india.csv"
    with open(raw_csv_path, "w", encoding="utf-8") as f:
        # Re-export standardized CSV
        f.write("latitude,longitude,acq_date,acq_time,frp,confidence,bright_ti4,bright_ti5,satellite,instrument,daynight\n")
        for h in deduped_hotspots:
            f.write(
                f"{h.latitude},{h.longitude},{h.acq_date or ''},{h.acq_time or ''},{h.frp},"
                f"{h.confidence or ''},{h.bright_ti4 or ''},{h.bright_ti5 or ''},"
                f"{h.satellite or ''},{h.instrument or ''},{h.daynight or ''}\n"
            )
    print(f"[OK] Saved raw CSV to: {raw_csv_path}")

    raw_json_path = OUTPUT_DIR / "firms_raw_india.json"
    with open(raw_json_path, "w", encoding="utf-8") as f:
        json.dump([h.model_dump() for h in deduped_hotspots], f, indent=2, default=str)
    print(f"[OK] Saved raw JSON to: {raw_json_path}")

    # 4. Process Through Full AgniDrishti Intelligence Pipeline
    print("\n[*] Processing detections through AgniDrishti 10-step pipeline...")
    print("    - Context enrichment (OSM industrial infrastructure & land cover)")
    print("    - Spatial clustering (geodesic DBSCAN)")
    print("    - Temporal baseline analysis (Known/Expected vs New/Anomalous)")
    print("    - Multi-tier classification & evidence verification")
    print("    - Response priority scoring (LOW, MEDIUM, HIGH)")

    pipeline = AgniDrishtiPipeline()
    batch_response = await pipeline.analyze_batch(deduped_hotspots)

    # 5. Save Analyzed Results
    analyzed_json_path = OUTPUT_DIR / "agnidrishti_analyzed_dataset.json"
    with open(analyzed_json_path, "w", encoding="utf-8") as f:
        json.dump(batch_response.model_dump(mode="json"), f, indent=2)
    print(f"[OK] Saved complete analyzed dataset to: {analyzed_json_path}")

    # 6. Save GeoJSON FeatureCollection
    geojson_path = OUTPUT_DIR / "agnidrishti_analyzed_geojson.json"
    geojson_data = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "AgniDrishti Satellite Thermal Hotspots",
            "total_hotspots": batch_response.total_hotspots,
            "clusters_count": batch_response.clusters_count,
            "counts_by_classification": batch_response.counts_by_classification,
            "counts_by_priority": batch_response.counts_by_priority,
        },
        "features": [r.geojson_feature for r in batch_response.results if r.geojson_feature],
    }
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    print(f"[OK] Saved GIS GeoJSON to: {geojson_path}")

    # Persist to SQLite
    save_hotspots(batch_response.results)
    print(f"[OK] Successfully cached into SQLite database (agnidrishti.db)")

    # 7. Print Executive Summary
    print("\n" + "=" * 70)
    print(" AGNI DRISHTI -- DATASET GENERATION & ANALYSIS SUMMARY")
    print("=" * 70)
    print(f"Total Hotspots Analyzed:  {batch_response.total_hotspots}")
    print(f"DBSCAN Spatial Clusters:  {batch_response.clusters_count}")
    print("-" * 70)
    print("CLASSIFICATION BREAKDOWN:")
    for cat, count in batch_response.counts_by_classification.items():
        pct = (count / batch_response.total_hotspots * 100) if batch_response.total_hotspots else 0
        print(f"  * {cat:<12}: {count:>4} ({pct:>5.1f}%)")
    print("-" * 70)
    print("RESPONSE PRIORITY BREAKDOWN:")
    for prio, count in batch_response.counts_by_priority.items():
        pct = (count / batch_response.total_hotspots * 100) if batch_response.total_hotspots else 0
        print(f"  [{prio:<6}] {prio:<8}: {count:>4} ({pct:>5.1f}%)")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
