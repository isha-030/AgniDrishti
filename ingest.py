"""
ingest.py - Data ingestion and sanitization module for AgniDrishti.
Parses NASA FIRMS CSV, JSON, and GeoJSON files/streams, normalizes schema variations
between MODIS and VIIRS satellites, and cleanses coordinates and timestamps.
"""

from __future__ import annotations
import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Union
import pandas as pd
from hotspots import HotspotRaw


def parse_datetime(acq_date: Optional[str], acq_time: Optional[str]) -> datetime:
    """Combines acq_date (YYYY-MM-DD) and acq_time (HHMM) into a timezone-aware UTC datetime."""
    now = datetime.now(timezone.utc)
    if not acq_date:
        return now

    date_str = str(acq_date).strip()
    time_str = str(acq_time or "0000").strip().zfill(4)

    # Format HHMM e.g. '0215' -> 02:15
    if len(time_str) >= 4:
        hour = int(time_str[:2])
        minute = int(time_str[2:4])
    else:
        hour, minute = 0, 0

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(hour=min(hour, 23), minute=min(minute, 59), tzinfo=timezone.utc)
    except Exception:
        try:
            dt = datetime.fromisoformat(date_str)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            return now


def normalize_confidence(conf_val: Any) -> float:
    """Converts VIIRS (low/nominal/high or 'l'/'n'/'h') or MODIS (0-100) into a 0.0 - 1.0 confidence score."""
    if conf_val is None:
        return 0.5

    s = str(conf_val).strip().lower()
    if s in ("l", "low"):
        return 0.3
    if s in ("n", "nominal", "nom"):
        return 0.7
    if s in ("h", "high"):
        return 0.95

    try:
        val = float(s)
        if val > 1.0:
            return min(val / 100.0, 1.0)
        return max(min(val, 1.0), 0.0)
    except ValueError:
        return 0.5


class IngestionEngine:
    """Ingests, cleanses, and standardizes satellite thermal hotspot detections."""

    @classmethod
    def from_csv_bytes(cls, content_bytes: bytes) -> List[HotspotRaw]:
        """Parses raw CSV bytes into validated HotspotRaw records."""
        text = content_bytes.decode("utf-8", errors="replace")
        return cls.from_csv_text(text)

    @classmethod
    def from_csv_text(cls, text: str) -> List[HotspotRaw]:
        """Parses CSV string into validated HotspotRaw records."""
        try:
            df = pd.read_csv(io.StringIO(text))
            return cls.from_dataframe(df)
        except Exception:
            # Fallback to standard csv reader
            reader = csv.DictReader(io.StringIO(text))
            return [cls._row_to_hotspot(row) for row in reader if cls._is_valid_row(row)]

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> List[HotspotRaw]:
        """Converts a pandas DataFrame of FIRMS detections into normalized HotspotRaw models."""
        df.columns = [c.strip().lower() for c in df.columns]

        # Check required columns
        lat_col = next((c for c in df.columns if "lat" in c), "latitude")
        lon_col = next((c for c in df.columns if "lon" in c), "longitude")
        if lat_col not in df.columns or lon_col not in df.columns:
            raise ValueError(f"Required spatial columns not found. Present columns: {list(df.columns)}")

        # Drop invalid coordinates
        df = df.dropna(subset=[lat_col, lon_col])
        df = df[(df[lat_col] >= -90.0) & (df[lat_col] <= 90.0)]
        df = df[(df[lon_col] >= -180.0) & (df[lon_col] <= 180.0)]

        # Drop negative FRP if column exists
        if "frp" in df.columns:
            df["frp"] = pd.to_numeric(df["frp"], errors="coerce").fillna(0.0)
            df = df[df["frp"] >= 0.0]

        hotspots: List[HotspotRaw] = []
        for idx, row in df.iterrows():
            d = row.to_dict()
            h = cls._row_to_hotspot(d, fallback_id=f"pt-{idx}")
            if h is not None:
                hotspots.append(h)

        return hotspots

    @classmethod
    def from_json_content(cls, content: Union[str, bytes, List[Dict[str, Any]]]) -> List[HotspotRaw]:
        """Parses JSON string, bytes, or Python list/dict (including GeoJSON) into HotspotRaw."""
        if isinstance(content, (bytes, str)):
            parsed = json.loads(content)
        else:
            parsed = content

        # Handle GeoJSON FeatureCollection
        if isinstance(parsed, dict) and parsed.get("type") == "FeatureCollection":
            features = parsed.get("features", [])
            results = []
            for idx, feat in enumerate(features):
                geom = feat.get("geometry", {})
                props = feat.get("properties", {})
                if geom.get("type") == "Point" and len(geom.get("coordinates", [])) >= 2:
                    lon, lat = geom["coordinates"][:2]
                    props["latitude"] = lat
                    props["longitude"] = lon
                    h = cls._row_to_hotspot(props, fallback_id=f"geojson-{idx}")
                    if h:
                        results.append(h)
            return results

        if isinstance(parsed, list):
            return [cls._row_to_hotspot(item, fallback_id=f"json-{i}") for i, item in enumerate(parsed) if item]

        if isinstance(parsed, dict):
            # Single object
            h = cls._row_to_hotspot(parsed)
            return [h] if h else []

        return []

    @classmethod
    def _is_valid_row(cls, row: Dict[str, Any]) -> bool:
        try:
            lat = float(row.get("latitude") or row.get("lat", 999))
            lon = float(row.get("longitude") or row.get("lon", 999))
            return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0
        except Exception:
            return False

    @classmethod
    def _row_to_hotspot(cls, row: Dict[str, Any], fallback_id: Optional[str] = None) -> Optional[HotspotRaw]:
        try:
            lat = float(row.get("latitude") or row.get("lat"))
            lon = float(row.get("longitude") or row.get("lon"))
            frp = float(row.get("frp", 0.0) or 0.0)

            return HotspotRaw(
                latitude=lat,
                longitude=lon,
                acq_date=str(row.get("acq_date", "")).strip() or None,
                acq_time=str(row.get("acq_time", "")).strip() or None,
                frp=max(0.0, frp),
                confidence=row.get("confidence"),
                brightness=float(row["brightness"]) if row.get("brightness") else None,
                bright_ti4=float(row["bright_ti4"]) if row.get("bright_ti4") else None,
                bright_ti5=float(row["bright_ti5"]) if row.get("bright_ti5") else None,
                scan=float(row["scan"]) if row.get("scan") else None,
                track=float(row["track"]) if row.get("track") else None,
                satellite=str(row.get("satellite", "")) or None,
                instrument=str(row.get("instrument", "")) or None,
                daynight=str(row.get("daynight", "")).strip().upper() or None,
                hotspot_id=str(row.get("hotspot_id") or fallback_id or f"hs-{lat:.4f}-{lon:.4f}"),
            )
        except Exception:
            return None