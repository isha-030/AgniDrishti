import React, { useState } from 'react';
import {
  X,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  Clock,
} from 'lucide-react';
import type { Hotspot } from '../types';

interface AlertDetailsDrawerProps {
  alert: Hotspot | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReportModal: (hotspotId: string) => void;
  onViewFacility?: (facilityName: string) => void;
}

export const AlertDetailsDrawer: React.FC<AlertDetailsDrawerProps> = ({
  alert,
  isOpen,
  onClose,
  onOpenReportModal,
  onViewFacility,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'history' | 'satellite'>('overview');

  if (!isOpen || !alert) return null;

  const priorityColor =
    alert.priority === 'HIGH'
      ? 'var(--color-high)'
      : alert.priority === 'MEDIUM'
      ? 'var(--color-medium)'
      : 'var(--color-low)';

  const priorityBadgeClass =
    alert.priority === 'HIGH'
      ? 'badge-high'
      : alert.priority === 'MEDIUM'
      ? 'badge-medium'
      : 'badge-low';

  const facilityName = alert.nearest_facility?.name || 'Isolated / Rural Area';
  const hasFacility = Boolean(alert.nearest_facility);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
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

            <span className={`badge ${priorityBadgeClass}`}>
              {alert.priority} Priority
            </span>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              {facilityName}
            </h2>
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
                {alert.latitude.toFixed(4)}° N, {alert.longitude.toFixed(4)}° E
              </span>
              <span>&bull;</span>
              <Clock size={13} />
              <span>{new Date(alert.acq_datetime).toUTCString()}</span>
            </div>
          </div>

          {/* Classification & Status Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(255, 87, 34, 0.15)',
                color: '#ff7043',
                borderColor: 'rgba(255, 87, 34, 0.35)',
              }}
            >
              {alert.classification}
            </span>

            {alert.industrial_status && alert.industrial_status !== 'NOT_APPLICABLE' && (
              <span
                className="badge"
                style={{
                  backgroundColor:
                    alert.industrial_status === 'NEW_ANOMALOUS'
                      ? 'var(--color-high-bg)'
                      : 'var(--color-low-bg)',
                  color:
                    alert.industrial_status === 'NEW_ANOMALOUS'
                      ? 'var(--color-high)'
                      : 'var(--color-low)',
                  borderColor:
                    alert.industrial_status === 'NEW_ANOMALOUS'
                      ? 'var(--color-high-border)'
                      : 'var(--color-low-border)',
                }}
              >
                {alert.industrial_status.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0 20px',
          }}
        >
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'evidence', label: 'Evidence Audit' },
            { id: 'history', label: 'Historical Baseline' },
            { id: 'satellite', label: 'Satellite Info' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 14px',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Primary Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                }}
              >
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Current FRP
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: priorityColor }} className="font-mono">
                    {alert.frp.toFixed(1)} <span style={{ fontSize: '13px', fontWeight: 500 }}>MW</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Baseline Mean
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {alert.baseline_comparison.baseline_mean_frp !== null && alert.baseline_comparison.baseline_mean_frp !== undefined
                      ? alert.baseline_comparison.baseline_mean_frp.toFixed(1)
                      : '—'}{' '}
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>MW</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Deviation Ratio
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {alert.baseline_comparison.frp_ratio !== null && alert.baseline_comparison.frp_ratio !== undefined
                      ? `${alert.baseline_comparison.frp_ratio.toFixed(1)}x`
                      : '—'}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Z-Score
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {alert.baseline_comparison.z_score !== null && alert.baseline_comparison.z_score !== undefined
                      ? `${alert.baseline_comparison.z_score > 0 ? '+' : ''}${alert.baseline_comparison.z_score.toFixed(1)} σ`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Rationale & Conclusion */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  borderLeft: `4px solid ${priorityColor}`,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  Investigator Summary
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {alert.priority_reason}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {alert.baseline_comparison.explanation}
                </p>
              </div>

              {/* Context Summary Fields */}
              <div className="card" style={{ padding: '18px' }}>
                <h4 style={{ fontSize: '13px', color: '#ffffff', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Geospatial Context
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nearest Facility:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      {hasFacility ? alert.nearest_facility?.name : 'None in buffer'}
                    </span>
                  </div>

                  {hasFacility && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Facility Distance:</span>
                        <span style={{ color: '#ffffff', fontWeight: 500 }} className="font-mono">
                          {alert.nearest_facility?.distance_meters.toFixed(0)} meters
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Facility Type:</span>
                        <span style={{ color: '#ffffff', fontWeight: 500 }}>
                          {alert.nearest_facility?.facility_type.toUpperCase()}
                        </span>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Surrounding Land Cover:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      {alert.land_cover.dominant_type}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cluster Envelope:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      Cluster #{alert.cluster.cluster_id} ({alert.cluster.size} pts, {alert.cluster.total_frp.toFixed(1)} MW total)
                    </span>
                  </div>
                </div>
              </div>

              {hasFacility && onViewFacility && (
                <button
                  onClick={() => onViewFacility(alert.nearest_facility!.name)}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  <Building2 size={16} />
                  <span>Inspect Facility Baseline ({alert.nearest_facility!.name})</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '13px', color: '#ffffff', marginBottom: '8px' }}>
                  Verification Audit Rationale
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {alert.evidence_report.summary}
                </p>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Net Confidence Score: <b style={{ color: '#ffffff' }}>{alert.evidence_report.net_score}</b>
                </div>
              </div>

              {/* Supporting Evidence */}
              <div>
                <h4
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-low)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle2 size={15} />
                  Supporting Evidence ({alert.evidence_report.supporting_evidence.length})
                </h4>

                {alert.evidence_report.supporting_evidence.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alert.evidence_report.supporting_evidence.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--color-low-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                        }}
                      >
                        <span style={{ color: 'var(--color-low)', fontSize: '16px' }}>✓</span>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {item.description}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No supporting evidence recorded.
                  </div>
                )}
              </div>

              {/* Counter Evidence */}
              <div>
                <h4
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-medium)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertTriangle size={15} />
                  Counter-Evidence / Conflicting Signals ({alert.evidence_report.counter_evidence.length})
                </h4>

                {alert.evidence_report.counter_evidence.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alert.evidence_report.counter_evidence.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--color-medium-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                        }}
                      >
                        <span style={{ color: 'var(--color-medium)', fontSize: '16px' }}>⚠</span>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {item.description}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No counter-evidence flagged. Signals are consistent.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '18px' }}>
                <h4 style={{ fontSize: '14px', color: '#ffffff', marginBottom: '8px' }}>
                  Site-Specific Baseline Comparison
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Compares current detection against the normal 30-day thermal output distribution for this exact facility.
                </p>

                {alert.baseline_comparison.baseline_mean_frp !== null && alert.baseline_comparison.baseline_mean_frp !== undefined ? (
                  <div>
                    {/* Visual Bar Comparison */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span>Historical Normal Baseline:</span>
                        <span className="font-mono">~{alert.baseline_comparison.baseline_mean_frp.toFixed(1)} MW</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--color-low)' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span>Current Observed FRP:</span>
                        <span className="font-mono" style={{ color: priorityColor }}>{alert.frp.toFixed(1)} MW</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, (alert.frp / (alert.baseline_comparison.baseline_mean_frp * 2.5)) * 100)}%`,
                            height: '100%',
                            backgroundColor: priorityColor,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {alert.baseline_comparison.status === 'NEW_ANOMALOUS' ? (
                        <span style={{ color: 'var(--color-high)', fontWeight: 600 }}>
                          Case B (Unusual): Current activity exceeds expected variance threshold.
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-low)', fontWeight: 600 }}>
                          Case A (Normal): Current activity conforms to typical operational baseline.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Historical baseline data unavailable for this location.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'satellite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '18px' }}>
                <h4 style={{ fontSize: '14px', color: '#ffffff', marginBottom: '14px' }}>
                  NASA FIRMS Detection Metadata
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Satellite Instrument:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      {alert.satellite || 'VIIRS'} ({alert.daynight === 'N' ? 'Night Pass' : 'Day Pass'})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Detection Confidence:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      {String(alert.confidence || 'Nominal').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Classification Confidence:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>
                      {(alert.classification_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Detection ID:</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }} className="font-mono">
                      {alert.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={() => onOpenReportModal(alert.id)}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            <FileText size={16} />
            <span>Generate Incident Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
