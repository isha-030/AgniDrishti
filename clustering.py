"""
clustering.py - Spatial analysis and clustering module using DBSCAN for AgniDrishti.
Groups nearby thermal detections around facilities or fire fronts into unified
thermal activity clusters rather than treating each satellite pixel independently.
"""

from __future__ import annotations
import math
from typing import Dict, List, Tuple
import numpy as np
from hotspots import ClusterInfo, HotspotRaw

try:
    from sklearn.cluster import DBSCAN
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


EARTH_RADIUS_KM = 6371.0


class SpatialClusterer:
    """Groups satellite hotspots into thermal activity clusters using geodesic DBSCAN."""

    def __init__(self, eps_km: float = 1.0, min_samples: int = 1):
        """
        :param eps_km: Maximum distance in kilometers between two samples for them to be considered
                       in the same neighborhood. Default 1.0 km.
        :param min_samples: Number of samples in a neighborhood for a core point. Default 1.
        """
        self.eps_km = eps_km
        self.min_samples = min_samples

    def cluster_hotspots(
        self, hotspots: List[HotspotRaw]
    ) -> Tuple[List[ClusterInfo], Dict[int, ClusterInfo]]:
        """
        Performs DBSCAN clustering on the hotspots.
        Returns:
            - List of distinct ClusterInfo objects.
            - Mapping from hotspot index -> ClusterInfo.
        """
        if not hotspots:
            return [], {}

        n_points = len(hotspots)
        if n_points == 1:
            h = hotspots[0]
            c = ClusterInfo(
                cluster_id=0,
                size=1,
                total_frp=h.frp,
                mean_frp=h.frp,
                centroid_lat=h.latitude,
                centroid_lon=h.longitude,
                bbox=[h.latitude, h.longitude, h.latitude, h.longitude],
            )
            return [c], {0: c}

        # Convert lat/lon degrees to radians for spherical metric
        coords_deg = np.array([[h.latitude, h.longitude] for h in hotspots])
        coords_rad = np.radians(coords_deg)

        eps_rad = self.eps_km / EARTH_RADIUS_KM

        if SKLEARN_AVAILABLE:
            db = DBSCAN(eps=eps_rad, min_samples=self.min_samples, metric="haversine")
            labels = db.fit_predict(coords_rad)
        else:
            labels = self._fallback_dbscan(coords_rad, eps_rad, self.min_samples)

        # Normalize negative/noise labels to individual unique cluster IDs if min_samples > 1
        max_label = max(labels) if len(labels) > 0 else 0
        cur_extra = max_label + 1
        normalized_labels = []
        for l in labels:
            if l == -1:
                normalized_labels.append(cur_extra)
                cur_extra += 1
            else:
                normalized_labels.append(l)

        # Aggregate points by cluster
        clusters_dict: Dict[int, List[int]] = {}
        for idx, lbl in enumerate(normalized_labels):
            clusters_dict.setdefault(lbl, []).append(idx)

        cluster_summaries: List[ClusterInfo] = []
        point_to_cluster: Dict[int, ClusterInfo] = {}

        for cluster_id, point_indices in clusters_dict.items():
            pts = [hotspots[i] for i in point_indices]
            lats = [p.latitude for p in pts]
            lons = [p.longitude for p in pts]
            frps = [p.frp for p in pts]

            total_frp = round(float(sum(frps)), 2)
            mean_frp = round(float(total_frp / len(pts)), 2)
            centroid_lat = round(float(np.mean(lats)), 5)
            centroid_lon = round(float(np.mean(lons)), 5)
            bbox = [
                round(float(min(lats)), 5),
                round(float(min(lons)), 5),
                round(float(max(lats)), 5),
                round(float(max(lons)), 5),
            ]

            info = ClusterInfo(
                cluster_id=cluster_id,
                size=len(pts),
                total_frp=total_frp,
                mean_frp=mean_frp,
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                bbox=bbox,
            )
            cluster_summaries.append(info)
            for idx in point_indices:
                point_to_cluster[idx] = info

        return cluster_summaries, point_to_cluster

    def _fallback_dbscan(
        self, coords_rad: np.ndarray, eps_rad: float, min_samples: int
    ) -> List[int]:
        """Pure-Python / NumPy spherical DBSCAN fallback."""
        n = len(coords_rad)
        visited = [False] * n
        labels = [-1] * n
        cluster_id = 0

        def haversine_np(p1, p2):
            dlat = p2[0] - p1[0]
            dlon = p2[1] - p1[1]
            a = np.sin(dlat / 2.0) ** 2 + np.cos(p1[0]) * np.cos(p2[0]) * np.sin(dlon / 2.0) ** 2
            return 2.0 * np.arcsin(np.clip(np.sqrt(a), 0, 1))

        for i in range(n):
            if visited[i]:
                continue
            visited[i] = True

            # Find neighbors
            neighbors = []
            for j in range(n):
                if haversine_np(coords_rad[i], coords_rad[j]) <= eps_rad:
                    neighbors.append(j)

            if len(neighbors) < min_samples:
                labels[i] = -1
            else:
                labels[i] = cluster_id
                queue = [idx for idx in neighbors if idx != i]
                while queue:
                    curr = queue.pop(0)
                    if not visited[curr]:
                        visited[curr] = True
                        curr_neighbors = [
                            k for k in range(n) if haversine_np(coords_rad[curr], coords_rad[k]) <= eps_rad
                        ]
                        if len(curr_neighbors) >= min_samples:
                            for cn in curr_neighbors:
                                if cn not in queue and not visited[cn]:
                                    queue.append(cn)
                    if labels[curr] == -1:
                        labels[curr] = cluster_id
                cluster_id += 1

        return labels
