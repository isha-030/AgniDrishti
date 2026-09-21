import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface LeafletMapProps {
  hotspotsGeoJSON?: any;
  clustersGeoJSON?: any;
  facilities?: any[];
  selectedHotspotId?: string | null;
  onSelectHotspot?: (id: string) => void;
  baseLayer?: 'dark' | 'satellite';
  layersVisibility?: {
    hotspots: boolean;
    facilities: boolean;
    clusters: boolean;
    boundaries: boolean;
  };
  center?: [number, number];
  zoom?: number;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  hotspotsGeoJSON,
  clustersGeoJSON,
  facilities = [],
  selectedHotspotId,
  onSelectHotspot,
  baseLayer = 'dark',
  layersVisibility = { hotspots: true, facilities: true, clusters: true, boundaries: true },
  center = [20.5937, 78.9629], // Center on India
  zoom = 5,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const clustersLayerRef = useRef<L.LayerGroup | null>(null);
  const facilitiesLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    clustersLayerRef.current = L.layerGroup().addTo(map);
    facilitiesLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate map size after DOM mount
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer (Dark vs Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      baseLayer === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
  }, [baseLayer]);

  // Render Hotspots Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !hotspotsLayerRef.current) return;
    const layer = hotspotsLayerRef.current;
    layer.clearLayers();

    if (!layersVisibility.hotspots || !hotspotsGeoJSON?.features) return;

    hotspotsGeoJSON.features.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const [lon, lat] = coords;
      const props = feat.properties || {};
      const isSelected = selectedHotspotId === props.id;

      const priority = props.priority || 'LOW';
      const color =
        priority === 'HIGH'
          ? '#ef4444'
          : priority === 'MEDIUM'
          ? '#f59e0b'
          : '#10b981';

      const radius = isSelected ? 11 : priority === 'HIGH' ? 8 : 5.5;

      const marker = L.circleMarker([lat, lon], {
        radius,
        fillColor: color,
        fillOpacity: isSelected ? 1.0 : 0.85,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 1.5,
      });

      // Compact Popup
      const facilityText = props.facility_name
        ? `${props.facility_name} (${props.facility_distance_m ? Math.round(props.facility_distance_m) + 'm' : ''})`
        : 'None detected in buffer';

      const statusBadge = props.industrial_status && props.industrial_status !== 'NOT_APPLICABLE'
        ? `<div style="font-size:11px; margin-bottom:4px; color:#93c5fd;">Status: <b>${props.industrial_status.replace('_', ' ')}</b></div>`
        : '';

      const popupHtml = `
        <div style="font-family:Inter, sans-serif; min-width:230px; padding:2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:11px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:0.04em;">
              ${priority} PRIORITY &bull; ${props.classification}
            </span>
          </div>
          ${statusBadge}
          <div style="font-size:12px; margin-bottom:2px; color:#e2e8f0;"><b>FRP:</b> <span style="color:#ffffff; font-weight:600;">${props.frp ? props.frp.toFixed(1) : 0} MW</span></div>
          <div style="font-size:12px; margin-bottom:2px; color:#e2e8f0;"><b>Confidence:</b> ${props.confidence || 'Nominal'}</div>
          <div style="font-size:12px; margin-bottom:6px; color:#e2e8f0;"><b>Facility:</b> ${facilityText}</div>
          <p style="font-size:11px; color:#94a3b8; margin-bottom:10px; line-height:1.35;">
            ${props.priority_reason || ''}
          </p>
          <button 
            id="view-alert-btn-${props.id}"
            style="width:100%; background:linear-gradient(135deg, #ff5722 0%, #ff8c00 100%); color:#ffffff; border:none; padding:7px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(255, 87, 34, 0.4);"
          >
            Investigate Hotspot &rarr;
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 270,
        className: 'agnidrishti-leaflet-popup',
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-alert-btn-${props.id}`);
        if (btn && onSelectHotspot) {
          btn.onclick = (e) => {
            e.stopPropagation();
            onSelectHotspot(props.id);
          };
        }
      });

      marker.addTo(layer);
    });
  }, [hotspotsGeoJSON, layersVisibility.hotspots, selectedHotspotId, onSelectHotspot]);

  // Render Clusters Layer (Polygons)
  useEffect(() => {
    if (!mapInstanceRef.current || !clustersLayerRef.current) return;
    const layer = clustersLayerRef.current;
    layer.clearLayers();

    if (!layersVisibility.clusters || !clustersGeoJSON?.features) return;

    clustersGeoJSON.features.forEach((feat: any) => {
      const polygon = L.geoJSON(feat, {
        style: {
          color: '#6366f1',
          weight: 1.5,
          dashArray: '4, 4',
          fillColor: '#6366f1',
          fillOpacity: 0.1,
        },
      });

      const props = feat.properties || {};
      polygon.bindTooltip(
        `Cluster #${props.cluster_id}: ${props.point_count} pts (${props.total_frp?.toFixed(1)} MW)`,
        { sticky: true }
      );

      polygon.addTo(layer);
    });
  }, [clustersGeoJSON, layersVisibility.clusters]);

  // Render Facilities Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !facilitiesLayerRef.current) return;
    const layer = facilitiesLayerRef.current;
    layer.clearLayers();

    if (!layersVisibility.facilities || !facilities.length) return;

    facilities.forEach((fac: any) => {
      if (!fac.latitude || !fac.longitude) return;

      const marker = L.circleMarker([fac.latitude, fac.longitude], {
        radius: 7,
        fillColor: '#8b5cf6',
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: 1.5,
      });

      marker.bindTooltip(
        `<b>${fac.name}</b><br/><span style="font-size:11px;">${fac.facility_type.toUpperCase()} &bull; Baseline ${fac.baseline_mean ? fac.baseline_mean + ' MW' : 'Active'}</span>`,
        { sticky: true }
      );

      marker.addTo(layer);
    });
  }, [facilities, layersVisibility.facilities]);

  // Zoom to selected hotspot
  useEffect(() => {
    if (!selectedHotspotId || !hotspotsGeoJSON?.features || !mapInstanceRef.current) return;
    const match = hotspotsGeoJSON.features.find((f: any) => f.properties?.id === selectedHotspotId);
    if (match && match.geometry?.coordinates) {
      const [lon, lat] = match.geometry.coordinates;
      mapInstanceRef.current.flyTo([lat, lon], 12, { duration: 1.2 });
    }
  }, [selectedHotspotId, hotspotsGeoJSON]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#090d16',
        zIndex: 1,
      }}
    />
  );
};
