import React, { useEffect, useState, useMemo } from 'react';
import {
  Layers,
  Map as MapIcon,
  Globe,
  Box,
  Sliders,
  Flame,
} from 'lucide-react';
import { LeafletMap } from '../../components/maps/LeafletMap';
import { Map3DViewer } from '../../components/maps/Map3DViewer';
import { api } from '../../services/api';
import type { FacilitySummary } from '../../types';

interface LiveMapPageProps {
  onSelectHotspot: (id: string) => void;
  selectedHotspotId?: string | null;
}

export const LiveMapPage: React.FC<LiveMapPageProps> = ({
  onSelectHotspot,
  selectedHotspotId,
}) => {
  const [viewMode, setViewMode] = useState<'2d' | 'satellite' | '3d'>('2d');
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [clustersData, setClustersData] = useState<any>(null);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Layer Visibility
  const [layers, setLayers] = useState({
    hotspots: true,
    facilities: true,
    clusters: true,
    boundaries: true,
  });

  // Filters
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [minFrp, setMinFrp] = useState<number>(0);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hotspotsRes, clustersRes, facsRes] = await Promise.all([
        api.getHotspotsGeoJSON(),
        api.getClusters(),
        api.getFacilities(),
      ]);

      setGeojsonData(hotspotsRes);
      setClustersData(clustersRes);
      setFacilities(facsRes.facilities);
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered GeoJSON features
  const filteredGeoJSON = useMemo(() => {
    if (!geojsonData || !geojsonData.features) return null;

    const filtered = geojsonData.features.filter((feat: any) => {
      const props = feat.properties || {};
      if (selectedPriority !== 'ALL' && props.priority !== selectedPriority) return false;
      if (selectedClassification !== 'ALL' && props.classification !== selectedClassification) return false;
      if (props.frp < minFrp) return false;
      return true;
    });

    return {
      ...geojsonData,
      features: filtered,
    };
  }, [geojsonData, selectedPriority, selectedClassification, minFrp]);

  const activeCount = filteredGeoJSON?.features?.length || 0;
  const maxFrpInView = useMemo(() => {
    if (!filteredGeoJSON?.features?.length) return 0;
    return Math.max(...filteredGeoJSON.features.map((f: any) => f.properties?.frp || 0));
  }, [filteredGeoJSON]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Top Floating Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          zIndex: 1010,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'rgba(17, 24, 39, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Mode Selector */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', padding: '2px', borderRadius: '4px' }}>
          <button
            onClick={() => setViewMode('2d')}
            className={`btn btn-sm ${viewMode === '2d' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', height: '28px' }}
          >
            <MapIcon size={14} />
            <span>2D Map</span>
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`btn btn-sm ${viewMode === 'satellite' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', height: '28px' }}
          >
            <Globe size={14} />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`btn btn-sm ${viewMode === '3d' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', height: '28px' }}
          >
            <Box size={14} />
            <span>3D View</span>
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Live Feature Count Badge */}
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={14} color="var(--brand-primary)" />
          <span>Showing: <b style={{ color: '#ffffff' }}>{loading ? 'Loading...' : activeCount}</b> hotspots</span>
        </div>

        {maxFrpInView > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            &bull; Peak: <b className="font-mono" style={{ color: 'var(--color-high)' }}>{maxFrpInView.toFixed(1)} MW</b>
          </div>
        )}

        {/* Toggle Filter Panel */}
        <button
          onClick={() => setIsFilterPanelOpen((prev) => !prev)}
          className={`btn btn-sm ${isFilterPanelOpen ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ height: '28px', padding: '4px 8px' }}
          title="Toggle Layers & Filter Panel"
        >
          <Sliders size={14} />
          <span>Layers & Filters</span>
        </button>
      </div>

      {/* Main Map Canvas / 3D Canvas */}
      <div style={{ width: '100%', height: '100%' }}>
        {viewMode === '3d' ? (
          <Map3DViewer
            hotspotsGeoJSON={filteredGeoJSON}
            facilities={layers.facilities ? facilities : []}
            onSelectHotspot={onSelectHotspot}
            selectedHotspotId={selectedHotspotId}
          />
        ) : (
          <LeafletMap
            hotspotsGeoJSON={filteredGeoJSON}
            clustersGeoJSON={clustersData}
            facilities={facilities}
            baseLayer={viewMode === 'satellite' ? 'satellite' : 'dark'}
            layersVisibility={layers}
            selectedHotspotId={selectedHotspotId}
            onSelectHotspot={onSelectHotspot}
            center={[21.5, 79.5]}
            zoom={5}
          />
        )}
      </div>

      {/* Floating Collapsible Layers & Filters Sidepanel */}
      {isFilterPanelOpen && (
        <div
          style={{
            position: 'absolute',
            top: '74px',
            left: '20px',
            zIndex: 1015,
            width: '280px',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--brand-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                Layers & Intelligence
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedPriority('ALL');
                setSelectedClassification('ALL');
                setMinFrp(0);
              }}
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>

          {/* Layer Visibility Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Map Layers
            </span>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--brand-primary)',
                  }}
                />
                <span>Thermal Hotspots</span>
              </div>
              <input
                type="checkbox"
                checked={layers.hotspots}
                onChange={(e) => setLayers((prev) => ({ ...prev, hotspots: e.target.checked }))}
              />
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#8b5cf6',
                  }}
                />
                <span>Industrial Facilities ({facilities.length})</span>
              </div>
              <input
                type="checkbox"
                checked={layers.facilities}
                onChange={(e) => setLayers((prev) => ({ ...prev, facilities: e.target.checked }))}
              />
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#6366f1',
                  }}
                />
                <span>DBSCAN Envelopes</span>
              </div>
              <input
                type="checkbox"
                checked={layers.clusters}
                onChange={(e) => setLayers((prev) => ({ ...prev, clusters: e.target.checked }))}
              />
            </label>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

          {/* Classification Filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Classification
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
            >
              <option value="ALL">All Categories</option>
              <option value="INDUSTRIAL">Industrial Activity</option>
              <option value="NATURAL">Natural / Forest Fire</option>
              <option value="UNCERTAIN">Uncertain / Triage</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Priority Level
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedPriority(lvl)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '11px',
                    fontWeight: selectedPriority === lvl ? 600 : 500,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: selectedPriority === lvl ? 'var(--brand-primary)' : 'var(--border-subtle)',
                    backgroundColor: selectedPriority === lvl ? 'rgba(255, 87, 34, 0.15)' : 'transparent',
                    color: selectedPriority === lvl ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Min FRP Threshold Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min FRP Intensity</span>
              <span className="font-mono" style={{ color: '#ffffff' }}>&ge; {minFrp} MW</span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              step={5}
              value={minFrp}
              onChange={(e) => setMinFrp(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Map Legend */}
          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Priority Indicator Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-high)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>High Priority (Immediate Triage)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-medium)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Medium Priority (Expected Flares)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-low)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Low Priority (Natural / Rural)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
