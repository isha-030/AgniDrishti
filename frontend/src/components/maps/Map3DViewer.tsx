import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface Map3DViewerProps {
  hotspotsGeoJSON?: any;
  facilities?: any[];
  onSelectHotspot?: (id: string) => void;
  selectedHotspotId?: string | null;
}

export const Map3DViewer: React.FC<Map3DViewerProps> = ({
  hotspotsGeoJSON,
  facilities = [],
  onSelectHotspot,
  selectedHotspotId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ pitch: 45, yaw: 30 }); // degrees
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Reset Camera View
  const handleReset = () => {
    setRotation({ pitch: 45, yaw: 30 });
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  };

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragMode(e.button === 2 || e.shiftKey ? 'pan' : 'rotate');
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      // Check hover
      checkHover(e.clientX, e.clientY);
      return;
    }

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    setLastMouse({ x: e.clientX, y: e.clientY });

    if (dragMode === 'rotate') {
      setRotation((prev) => ({
        pitch: Math.max(15, Math.min(85, prev.pitch + deltaY * 0.4)),
        yaw: (prev.yaw + deltaX * 0.5) % 360,
      }));
    } else {
      setPan((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.4, Math.min(4.0, prev * factor)));
  };

  // Project lat/lon to 3D coordinate plane
  const project3D = (
    lat: number,
    lon: number,
    elevation: number,
    width: number,
    height: number
  ) => {
    // Center around India (lat: 21, lon: 79)
    const centerLat = 21.0;
    const centerLon = 79.0;
    const scale = 32.0 * zoom;

    const x2D = (lon - centerLon) * scale;
    const y2D = (centerLat - lat) * scale;
    const z2D = elevation * 1.8 * zoom;

    // Apply Yaw (Y-axis rotation) and Pitch (X-axis tilt)
    const yawRad = (rotation.yaw * Math.PI) / 180;
    const pitchRad = (rotation.pitch * Math.PI) / 180;

    // Rotate yaw around vertical axis
    const rotX = x2D * Math.cos(yawRad) - y2D * Math.sin(yawRad);
    const rotY = x2D * Math.sin(yawRad) + y2D * Math.cos(yawRad);

    // Apply pitch tilt
    const projX = rotX;
    const projY = rotY * Math.sin(pitchRad) - z2D * Math.cos(pitchRad);

    return {
      screenX: width / 2 + pan.x + projX,
      screenY: height / 2 + pan.y + projY,
      depth: rotY * Math.cos(pitchRad) + z2D * Math.sin(pitchRad),
    };
  };

  const checkHover = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !hotspotsGeoJSON?.features) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    let found = null;
    hotspotsGeoJSON.features.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates;
      if (!coords) return;
      const [lon, lat] = coords;
      const frp = feat.properties?.frp || 10;
      const proj = project3D(lat, lon, frp * 0.4, canvas.width, canvas.height);
      const dist = Math.hypot(proj.screenX - mouseX, proj.screenY - mouseY);
      if (dist < 12) {
        found = feat;
      }
    });

    setHoveredPoint(found);
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to parent
    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    ctx.clearRect(0, 0, width, height);

    // 1. Draw 3D Base Coordinate Grid Plane
    ctx.strokeStyle = 'rgba(42, 62, 92, 0.4)';
    ctx.lineWidth = 1;

    const gridSize = 12;

    for (let i = -gridSize; i <= gridSize; i += 2) {
      // Latitude grid lines
      const pStart = project3D(21 + i, 79 - gridSize, 0, width, height);
      const pEnd = project3D(21 + i, 79 + gridSize, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(pStart.screenX, pStart.screenY);
      ctx.lineTo(pEnd.screenX, pEnd.screenY);
      ctx.stroke();

      // Longitude grid lines
      const pStartLon = project3D(21 - gridSize, 79 + i, 0, width, height);
      const pEndLon = project3D(21 + gridSize, 79 + i, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(pStartLon.screenX, pStartLon.screenY);
      ctx.lineTo(pEndLon.screenX, pEndLon.screenY);
      ctx.stroke();
    }

    // 2. Draw Facility 3D Structures
    facilities.forEach((fac) => {
      if (!fac.latitude || !fac.longitude) return;
      const base = project3D(fac.latitude, fac.longitude, 0, width, height);
      const top = project3D(fac.latitude, fac.longitude, 35, width, height);

      // Facility column
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(base.screenX, base.screenY);
      ctx.lineTo(top.screenX, top.screenY);
      ctx.stroke();

      // Beacon Top Sphere
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(top.screenX, top.screenY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Facility Name Tag
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText(fac.name, top.screenX + 8, top.screenY - 2);
    });

    // 3. Draw 3D Thermal Hotspot Columns (Height = FRP intensity)
    if (hotspotsGeoJSON?.features) {
      hotspotsGeoJSON.features.forEach((feat: any) => {
        const coords = feat.geometry?.coordinates;
        if (!coords) return;
        const [lon, lat] = coords;
        const props = feat.properties || {};
        const frp = Math.max(8, props.frp || 10);
        const priority = props.priority || 'LOW';
        const isSelected = selectedHotspotId === props.id;

        const color =
          priority === 'HIGH'
            ? '#ef4444'
            : priority === 'MEDIUM'
            ? '#f59e0b'
            : '#10b981';

        const base = project3D(lat, lon, 0, width, height);
        const top = project3D(lat, lon, frp * 0.45, width, height);

        // Vertical thermal pillar
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 4 : priority === 'HIGH' ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(base.screenX, base.screenY);
        ctx.lineTo(top.screenX, top.screenY);
        ctx.stroke();

        // Pillar Head Glow Marker
        ctx.fillStyle = isSelected ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(top.screenX, top.screenY, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Ground shadow dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(base.screenX, base.screenY, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [rotation, pan, zoom, hotspotsGeoJSON, facilities, selectedHotspotId]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#070b12',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {/* 3D Camera Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-medium)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          className="btn btn-ghost btn-sm"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
          className="btn btn-ghost btn-sm"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleReset}
          className="btn btn-ghost btn-sm"
          title="Reset 3D View"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Navigation instructions pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
        }}
      >
        <Compass size={14} color="var(--brand-primary)" />
        <span>
          <b>Drag</b> to Rotate &bull; <b>Right-Click / Shift+Drag</b> to Pan &bull; <b>Scroll</b> to Zoom
        </span>
      </div>

      {/* Hovered point popup */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-highlight)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            maxWidth: '260px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 20,
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-high)', textTransform: 'uppercase' }}>
            {hoveredPoint.properties?.priority} PRIORITY &bull; {hoveredPoint.properties?.classification}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '4px 0' }}>
            FRP: {hoveredPoint.properties?.frp} MW
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Facility: {hoveredPoint.properties?.facility_name || 'None within buffer'}
          </div>
          <button
            onClick={() => onSelectHotspot && onSelectHotspot(hoveredPoint.properties?.id)}
            className="btn btn-primary btn-sm"
            style={{ marginTop: '8px', width: '100%' }}
          >
            Investigate Alert
          </button>
        </div>
      )}
    </div>
  );
};
