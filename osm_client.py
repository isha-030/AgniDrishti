"""
osm_client.py - OpenStreetMap (OSM) / Overpass API Client for AgniDrishti.
Identifies nearby industrial infrastructure: refineries, power plants, chemical works,
factories, mines, steelworks, and industrial landuse.
Includes spatial caching and offline knowledge base of major facilities.
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import httpx
from hotspots import FacilityInfo


OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

HAZARDOUS_FACILITY_TYPES = {
    "refinery",
    "oil_refinery",
    "petrochemical",
    "chemical",
    "power_plant",
    "nuclear",
    "gas_processing",
    "explosives",
    "ammunition",
    "steelworks",
}


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes the great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


import asyncio

class OsmClient:
    """Client for discovering industrial infrastructure via OSM and curated registries."""

    def __init__(self, timeout_seconds: float = 5.0, max_concurrency: int = 5, enable_overpass: Optional[bool] = None):
        import os
        self.timeout_seconds = timeout_seconds
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._spatial_cache: Dict[str, Optional[FacilityInfo]] = {}
        if enable_overpass is not None:
            self.enable_overpass = enable_overpass
        else:
            self.enable_overpass = os.getenv("ENABLE_OVERPASS_API", "false").lower() in ("true", "1")

        # Curated regional industrial registry for offline reliability and guaranteed matching
        self._curated_registry: List[Dict[str, Any]] = [
            {
                "name": "Jamnagar Reliance Petroleum Refinery Complex",
                "lat": 22.3840,
                "lon": 69.8520,
                "facility_type": "refinery",
                "is_hazardous": True,
                "tags": {"industrial": "refinery", "operator": "Reliance Industries", "hazard": "extreme"},
            },
            {
                "name": "Bharat Petroleum & HPCL Refinery Mumbai (Mahul/Trombay)",
                "lat": 19.0120,
                "lon": 72.8990,
                "facility_type": "refinery",
                "is_hazardous": True,
                "tags": {"industrial": "refinery", "operator": "BPCL/HPCL", "hazard": "extreme"},
            },
            {
                "name": "Hazira Petrochemicals & LNG Terminal",
                "lat": 21.1120,
                "lon": 72.6350,
                "facility_type": "petrochemical",
                "is_hazardous": True,
                "tags": {"industrial": "chemical", "substance": "lng", "hazard": "extreme"},
            },
            {
                "name": "Tata Steel Integrated Works Jamshedpur",
                "lat": 22.7980,
                "lon": 86.1950,
                "facility_type": "steelworks",
                "is_hazardous": True,
                "tags": {"industrial": "steel", "operator": "Tata Steel", "hazard": "high"},
            },
            {
                "name": "Panipat IOCL Refinery & Naphtha Cracker",
                "lat": 29.4180,
                "lon": 76.9230,
                "facility_type": "refinery",
                "is_hazardous": True,
                "tags": {"industrial": "refinery", "operator": "IOCL", "hazard": "extreme"},
            },
            {
                "name": "Visakhapatnam HPCL Refinery & Coromandel Fertilisers",
                "lat": 17.6850,
                "lon": 83.2450,
                "facility_type": "refinery",
                "is_hazardous": True,
                "tags": {"industrial": "refinery", "hazard": "extreme"},
            },
            {
                "name": "Vindhyachal Super Thermal Power Station (NTPC)",
                "lat": 24.1010,
                "lon": 82.6680,
                "facility_type": "power_plant",
                "is_hazardous": True,
                "tags": {"power": "plant", "plant:source": "coal", "hazard": "high"},
            },
            {
                "name": "Mundra Thermal Power Plant & Port Industrial Estate",
                "lat": 22.8250,
                "lon": 69.5280,
                "facility_type": "power_plant",
                "is_hazardous": True,
                "tags": {"power": "plant", "industrial": "port_industrial", "hazard": "high"},
            },
            {
                "name": "Chakan Industrial Manufacturing Corridor Pune",
                "lat": 18.7550,
                "lon": 73.8500,
                "facility_type": "factory",
                "is_hazardous": False,
                "tags": {"landuse": "industrial", "type": "automotive_manufacturing"},
            },
        ]

    def _grid_key(self, lat: float, lon: float, precision: int = 2) -> str:
        """Rounds coordinates to create a spatial cache key (~1.1 km resolution)."""
        return f"{round(lat, precision)}:{round(lon, precision)}"

    async def find_nearest_facility(
        self, lat: float, lon: float, search_radius_meters: float = 2500.0
    ) -> Optional[FacilityInfo]:
        """
        Locates the nearest industrial facility to the hotspot.
        Checks spatial cache, curated registry, and queries Overpass API.
        """
        cache_key = self._grid_key(lat, lon)
        if cache_key in self._spatial_cache:
            cached = self._spatial_cache[cache_key]
            if cached:
                # Recalculate exact distance from actual point
                return cached.model_copy(
                    update={
                        "distance_meters": round(
                            haversine_distance_meters(
                                lat, lon, float(cached.tags.get("lat", lat)), float(cached.tags.get("lon", lon))
                            ),
                            1,
                        )
                    }
                )
            return None

        # 1. Check curated high-priority registry first
        nearest_curated: Optional[FacilityInfo] = None
        min_dist = float("inf")

        for item in self._curated_registry:
            dist = haversine_distance_meters(lat, lon, item["lat"], item["lon"])
            if dist <= search_radius_meters and dist < min_dist:
                min_dist = dist
                nearest_curated = FacilityInfo(
                    osm_id=f"curated-{item['facility_type']}",
                    name=item["name"],
                    facility_type=item["facility_type"],
                    distance_meters=round(dist, 1),
                    is_hazardous=item.get("is_hazardous", False),
                    tags={**item.get("tags", {}), "lat": str(item["lat"]), "lon": str(item["lon"])},
                )

        if nearest_curated is not None:
            self._spatial_cache[cache_key] = nearest_curated
            return nearest_curated

        # 2. Try Overpass API for real-time OSM data if enabled
        if self.enable_overpass:
            overpass_facility = await self._query_overpass(lat, lon, search_radius_meters)
            if overpass_facility:
                self._spatial_cache[cache_key] = overpass_facility
                return overpass_facility

        self._spatial_cache[cache_key] = None
        return None

    async def _query_overpass(
        self, lat: float, lon: float, radius_meters: float
    ) -> Optional[FacilityInfo]:
        """Constructs and executes an Overpass QL query around (lat, lon)."""
        query = f"""
        [out:json][timeout:{int(self.timeout_seconds)}];
        (
          node["industrial"](around:{radius_meters},{lat},{lon});
          way["industrial"](around:{radius_meters},{lat},{lon});
          node["power"="plant"](around:{radius_meters},{lat},{lon});
          way["power"="plant"](around:{radius_meters},{lat},{lon});
          node["man_made"~"works|flare|chimney|storage_tank"](around:{radius_meters},{lat},{lon});
          way["landuse"="industrial"](around:{radius_meters},{lat},{lon});
        );
        out center 5;
        """

        async with self._semaphore:
            for endpoint in OVERPASS_ENDPOINTS:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                        resp = await client.post(endpoint, data={"data": query})
                        if resp.status_code == 200:
                            data = resp.json()
                            elements = data.get("elements", [])
                            if not elements:
                                return None

                        # Find closest element
                        closest_elem = None
                        min_d = float("inf")

                        for elem in elements:
                            e_lat = elem.get("lat") or elem.get("center", {}).get("lat")
                            e_lon = elem.get("lon") or elem.get("center", {}).get("lon")
                            if e_lat is None or e_lon is None:
                                continue

                            d = haversine_distance_meters(lat, lon, float(e_lat), float(e_lon))
                            if d < min_d:
                                min_d = d
                                closest_elem = (elem, d, e_lat, e_lon)

                        if closest_elem:
                            elem, dist, e_lat, e_lon = closest_elem
                            tags = elem.get("tags", {})
                            name = tags.get("name", tags.get("operator", "Industrial Facility"))
                            facility_type = (
                                tags.get("industrial")
                                or tags.get("power")
                                or tags.get("man_made")
                                or tags.get("landuse", "industrial")
                            )
                            is_haz = facility_type in HAZARDOUS_FACILITY_TYPES or "hazard" in tags

                            return FacilityInfo(
                                osm_id=str(elem.get("id")),
                                name=name,
                                facility_type=str(facility_type),
                                distance_meters=round(dist, 1),
                                is_hazardous=is_haz,
                                tags={**tags, "lat": str(e_lat), "lon": str(e_lon)},
                            )
                except Exception:
                    continue

        return None
