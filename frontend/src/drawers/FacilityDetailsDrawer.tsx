import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Flame,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import type { FacilityDetail } from '../types';
import { Skeleton, ErrorState } from '../components/common/States';

interface FacilityDetailsDrawerProps {
  facilityName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onViewAlerts: (facilityName: string) => void;
  onSelectHotspot: (hotspotId: string) => void;
}

export const FacilityDetailsDrawer: React.FC<FacilityDetailsDrawerProps> = ({
  facilityName,
  isOpen,
  onClose,
  onViewAlerts,
  onSelectHotspot,
}) => {
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityName || !isOpen) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getFacilityDetail(facilityName);
        setDetail(res);
      } catch (err: any) {
        console.error('Failed to load facility detail:', err);
        setError(err.message || 'Failed to fetch facility details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [facilityName, isOpen]);

  if (!isOpen || !facilityName) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 8px', marginLeft: '-6px' }}
            >
              <X size={18} />
              <span>Close</span>
            </button>

            {detail?.is_hazardous && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--color-high)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldAlert size={12} />
                High Hazardous Site
              </span>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              {facilityName}
            </h2>
            {detail && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <MapPin size={13} color="var(--brand-primary)" />
                <span className="font-mono">
                  {detail.latitude.toFixed(4)}° N, {detail.longitude.toFixed(4)}° E
                </span>
                <span>&bull;</span>
                <span className="badge" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                  {detail.facility_type}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Skeleton height="80px" />
              <Skeleton height="140px" />
              <Skeleton height="180px" />
            </div>
          ) : error ? (
            <ErrorState message={error} />
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Thermal Statistics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                }}
              >
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Total Detections
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {detail.detections_count}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Mean Observed FRP
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-primary)' }} className="font-mono">
                    {detail.mean_frp ? detail.mean_frp.toFixed(1) : 0}{' '}
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>MW</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Max Peak FRP
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-high)' }} className="font-mono">
                    {detail.max_frp ? detail.max_frp.toFixed(1) : 0}{' '}
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>MW</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Baseline Mean
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {detail.baseline_mean !== null && detail.baseline_mean !== undefined
                      ? `${detail.baseline_mean.toFixed(1)} MW`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Baseline Explanation Card */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
                  Facility Profile & Baseline Intelligence
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This facility has a recorded recurrence profile across historical satellite overpasses.
                  New thermal observations within 2,500m are classified as expected industrial flaring when
                  FRP is within 2 standard deviations of normal, or flagged as anomalous if excessive heat is detected.
                </p>
              </div>

              {/* Associated Hotspots List */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Recent Satellite Detections ({detail.hotspots.length})
                  </span>
                </div>

                {detail.hotspots.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detail.hotspots.map((hotspotId: string) => (
                      <div
                        key={hotspotId}
                        onClick={() => onSelectHotspot(hotspotId)}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-highlight)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Flame size={14} color="var(--brand-primary)" />
                          <span className="font-mono" style={{ color: '#ffffff' }}>
                            {hotspotId}
                          </span>
                        </div>
                        <span style={{ color: 'var(--brand-primary)', fontSize: '11px', fontWeight: 500 }}>
                          Inspect &rarr;
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No individual hotspot links available.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <button
            onClick={() => onViewAlerts(facilityName)}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <span>View All Alerts for {facilityName}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
