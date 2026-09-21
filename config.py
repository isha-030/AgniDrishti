"""
config.py - Central configuration and thresholds for AgniDrishti.
"""

import os

MIN_BASELINE_SAMPLES: int = int(os.getenv("MIN_BASELINE_SAMPLES", "2"))
ANOMALY_ZSCORE_THRESHOLD: float = float(os.getenv("ANOMALY_ZSCORE_THRESHOLD", "2.0"))
FACILITY_PROXIMITY_M: float = float(os.getenv("FACILITY_PROXIMITY_M", "1500.0"))
DEFAULT_SEARCH_RADIUS_M: float = float(os.getenv("DEFAULT_SEARCH_RADIUS_M", "2500.0"))
DBSCAN_EPS_KM: float = float(os.getenv("DBSCAN_EPS_KM", "1.0"))
DBSCAN_MIN_SAMPLES: int = int(os.getenv("DBSCAN_MIN_SAMPLES", "1"))
SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "agnidrishti.db")
FIRMS_MAP_KEY: str = os.getenv("FIRMS_MAP_KEY", "")
