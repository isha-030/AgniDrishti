"""
database.py - Database persistence layer for AgniDrishti.
Provides load_hotspots and save_hotspots for SQLite and runtime cache.
"""

from __future__ import annotations
import json
import sqlite3
from typing import Any, Dict, List, Optional
from config import SQLITE_DB_PATH


# In-memory storage cache for immediate retrieval
_HOTSPOTS_CACHE: List[Dict[str, Any]] = []


class HotspotRecord:
    """Lightweight hotspot record matching the expected properties for GIS/Leaflet export."""
    def __init__(self, data: Dict[str, Any]):
        self._data = data
        self.id = str(data.get("id") or data.get("hotspot_id", ""))
        self.lat = float(data.get("latitude") or data.get("lat", 0.0))
        self.lon = float(data.get("longitude") or data.get("lon", 0.0))
        self.frp = float(data.get("frp", 0.0))
        self.confidence = data.get("confidence")

        raw_p = data.get("priority", "LOW")
        if hasattr(raw_p, "value"):
            raw_p = raw_p.value
        elif "." in str(raw_p):
            raw_p = str(raw_p).split(".")[-1]
        self.priority = str(raw_p).upper()

        raw_s = data.get("source_type") or data.get("classification", "UNCERTAIN")
        if hasattr(raw_s, "value"):
            raw_s = raw_s.value
        elif "." in str(raw_s):
            raw_s = str(raw_s).split(".")[-1]
        self.source_type = str(raw_s).upper()

        self.behaviour = data.get("behaviour") or data.get("industrial_status")
        self.facility_name = data.get("facility_name")
        self.facility_distance_m = data.get("facility_distance_m")

    def dict(self, exclude: Optional[set] = None) -> Dict[str, Any]:
        d = dict(self._data)
        d.update({
            "id": self.id,
            "lat": self.lat,
            "lon": self.lon,
            "frp": self.frp,
            "confidence": self.confidence,
            "priority": self.priority,
            "source_type": self.source_type,
            "behaviour": self.behaviour,
            "facility_name": self.facility_name,
            "facility_distance_m": self.facility_distance_m,
        })
        if exclude:
            for k in exclude:
                d.pop(k, None)
        return d


def init_db(db_path: str = SQLITE_DB_PATH):
    """Initializes the SQLite schema."""
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS hotspots_store (
                id TEXT PRIMARY KEY,
                lat REAL,
                lon REAL,
                frp REAL,
                priority TEXT,
                source_type TEXT,
                data_json TEXT
            )
            """
        )


def save_hotspots(records: List[Any], db_path: str = SQLITE_DB_PATH):
    """Saves records into memory and SQLite."""
    global _HOTSPOTS_CACHE
    _HOTSPOTS_CACHE = []
    init_db(db_path)

    with sqlite3.connect(db_path) as conn:
        for r in records:
            if hasattr(r, "model_dump"):
                d = r.model_dump(mode="json")
            elif hasattr(r, "dict"):
                d = r.dict()
            elif isinstance(r, dict):
                d = r
            else:
                d = vars(r)

            _HOTSPOTS_CACHE.append(d)
            h_id = str(d.get("id") or d.get("hotspot_id", ""))
            lat = float(d.get("latitude") or d.get("lat", 0.0))
            lon = float(d.get("longitude") or d.get("lon", 0.0))
            frp = float(d.get("frp", 0.0))
            priority = str(d.get("priority", "LOW"))
            source_type = str(d.get("classification") or d.get("source_type", "UNCERTAIN"))
            conn.execute(
                """
                INSERT OR REPLACE INTO hotspots_store (id, lat, lon, frp, priority, source_type, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (h_id, lat, lon, frp, priority, source_type, json.dumps(d, default=str)),
            )


def load_hotspots(db_path: str = SQLITE_DB_PATH) -> List[HotspotRecord]:
    """Loads hotspots from runtime cache or SQLite."""
    global _HOTSPOTS_CACHE
    if _HOTSPOTS_CACHE:
        return [HotspotRecord(d) for d in _HOTSPOTS_CACHE]

    init_db(db_path)
    records = []
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute("SELECT data_json FROM hotspots_store")
            for row in cursor.fetchall():
                d = json.loads(row[0])
                records.append(HotspotRecord(d))
    except Exception:
        pass

    return records
