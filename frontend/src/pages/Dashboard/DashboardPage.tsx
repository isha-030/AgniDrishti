import React, { useEffect, useState } from 'react';
import {
  Flame,
  ShieldAlert,
  AlertTriangle,
  Building2,
  TreePine,
  HelpCircle,
  Layers,
  ArrowRight,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import type { AlertListItem, DashboardSummary, FacilitySummary } from '../../types';
import { KPICard } from '../../components/common/KPICard';
import { LeafletMap } from '../../components/maps/LeafletMap';
import { Skeleton, ErrorState } from '../../components/common/States';

interface DashboardPageProps {
  onNavigateToMap: () => void;
  onNavigateToAlerts: (filter?: { priority?: string; classification?: string }) => void;
  onNavigateToFacilities: () => void;
  onSelectAlert: (id: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToMap,
  onNavigateToAlerts,
  onNavigateToFacilities,
  onSelectAlert,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertListItem[]>([]);
  const [topFacilities, setTopFacilities] = useState<FacilitySummary[]>([]);
  const [hotspotsGeoJSON, setHotspotsGeoJSON] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, alertsRes, facilitiesRes, geojsonData] = await Promise.all([
        api.getDashboardSummary(),
        api.getAlerts({ limit: 6, priority: 'HIGH' }),
        api.getFacilities(),
        api.getHotspotsGeoJSON(),
      ]);

      setSummary(summaryData);
      setRecentAlerts(alertsRes.alerts);
      setTopFacilities(facilitiesRes.facilities.slice(0, 5));
      setHotspotsGeoJSON(geojsonData);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to communicate with AgniDrishti backend service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (error) {
    return (
      <div style={{ padding: '32px' }}>
        <ErrorState message={error} onRetry={loadDashboardData} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome & Overview Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Mission Control & Geospatial Surveillance
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-spectral thermal anomaly classification running on NASA FIRMS & OSM telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onNavigateToAlerts()} className="btn btn-secondary btn-sm">
            <span>View All Alerts</span>
            <ArrowRight size={14} />
          </button>
          <button onClick={onNavigateToMap} className="btn btn-primary btn-sm">
            <span>Open Live GIS Map</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
        }}
      >
        <KPICard
          title="Total Hotspots"
          value={summary?.total_hotspots}
          subtitle="Unique satellite observations"
          icon={Flame}
          variant="brand"
          isLoading={loading}
          onClick={() => onNavigateToAlerts()}
        />
        <KPICard
          title="High Priority"
          value={summary?.high_priority}
          subtitle="Immediate action required"
          icon={ShieldAlert}
          variant="high"
          isLoading={loading}
          onClick={() => onNavigateToAlerts({ priority: 'HIGH' })}
        />
        <KPICard
          title="Industrial Sources"
          value={summary?.industrial}
          subtitle="Refineries, plants & flares"
          icon={Building2}
          variant="default"
          isLoading={loading}
          onClick={() => onNavigateToAlerts({ classification: 'INDUSTRIAL' })}
        />
        <KPICard
          title="Natural / Agro"
          value={summary?.natural}
          subtitle="Forest fires & biomass"
          icon={TreePine}
          variant="low"
          isLoading={loading}
          onClick={() => onNavigateToAlerts({ classification: 'NATURAL' })}
        />
        <KPICard
          title="Uncertain / Triage"
          value={summary?.uncertain}
          subtitle="Needs verification / audit"
          icon={HelpCircle}
          variant="uncertain"
          isLoading={loading}
          onClick={() => onNavigateToAlerts({ classification: 'UNCERTAIN' })}
        />
        <KPICard
          title="DBSCAN Clusters"
          value={summary?.clusters_count}
          subtitle="Multi-point spatial complexes"
          icon={Layers}
          variant="medium"
          isLoading={loading}
          onClick={onNavigateToMap}
        />
      </div>

      {/* Central Split Section: Quick Map & Urgent Alerts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          gap: '24px',
          minHeight: '440px',
        }}
      >
        {/* Interactive Map Preview Widget */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '480px',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color="var(--brand-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                Spatial Hotspot Distribution (India)
              </span>
            </div>
            <button
              onClick={onNavigateToMap}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              Full Screen Map &bull; 3D Mode &rarr;
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            {loading ? (
              <div style={{ padding: '24px', height: '100%' }}>
                <Skeleton height="100%" />
              </div>
            ) : (
              <LeafletMap
                hotspotsGeoJSON={hotspotsGeoJSON}
                onSelectHotspot={onSelectAlert}
                center={[21.5, 80.0]}
                zoom={5}
              />
            )}
          </div>
        </div>

        {/* Urgent High-Priority Anomalies List */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '480px',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="var(--color-high)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                Urgent High-Priority Anomalies
              </span>
            </div>
            <button
              onClick={() => onNavigateToAlerts({ priority: 'HIGH' })}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              View All ({summary?.high_priority ?? 0})
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
                <Skeleton height="60px" />
                <Skeleton height="60px" />
                <Skeleton height="60px" />
                <Skeleton height="60px" />
              </div>
            ) : recentAlerts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active high-priority anomalies detected.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => onSelectAlert(alert.id)}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-highlight)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '240px',
                        }}
                      >
                        {alert.facility_name || 'Unmapped Industrial Site'}
                      </span>
                      <span
                        className="badge badge-high"
                        style={{ fontSize: '10px', padding: '1px 6px' }}
                      >
                        {alert.priority}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={11} />
                        <span>{new Date(alert.acq_datetime).toLocaleDateString()}</span>
                        <span>&bull;</span>
                        <span className="font-mono" style={{ color: 'var(--color-high)', fontWeight: 600 }}>
                          {alert.frp.toFixed(1)} MW
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {alert.classification}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {alert.priority_reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monitored Industrial Facilities Spotlight Row */}
      <div className="card" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
              Key Industrial Facilities & Thermal Activity
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Refineries, petrochemical facilities, and steel complexes tracked against 30-day baseline.
            </p>
          </div>

          <button onClick={onNavigateToFacilities} className="btn btn-secondary btn-sm">
            <span>View All Facilities ({topFacilities.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <Skeleton height="140px" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            {topFacilities.map((fac) => (
              <div
                key={fac.name}
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {fac.facility_type}
                  </span>
                  {fac.is_hazardous && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--color-high)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      Hazardous
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                  {fac.name}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <span>Detections: <b>{fac.detections_count}</b></span>
                  <span>Mean: <b className="font-mono">{fac.mean_frp ? fac.mean_frp.toFixed(1) : 0} MW</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
