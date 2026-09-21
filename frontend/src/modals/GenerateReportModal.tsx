import React, { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Flame,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import type { IncidentReport } from '../types';
import { Skeleton, ErrorState } from '../components/common/States';

interface GenerateReportModalProps {
  hotspotId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  hotspotId,
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotspotId || !isOpen) {
      setReport(null);
      return;
    }

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.generateReport(hotspotId);
        setReport(data);
      } catch (err: any) {
        console.error('Failed to generate report:', err);
        setError(err.message || 'Failed to generate incident report.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [hotspotId, isOpen]);

  if (!isOpen || !hotspotId) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.report_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--brand-primary)" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
              Incident Intelligence Report
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {report && (
              <>
                <button onClick={handlePrint} className="btn btn-secondary btn-sm" title="Print or Save as PDF">
                  <Printer size={14} />
                  <span>Print / PDF</span>
                </button>
                <button onClick={handleDownloadJSON} className="btn btn-secondary btn-sm" title="Export JSON">
                  <Download size={14} />
                  <span>Export JSON</span>
                </button>
              </>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document */}
        <div style={{ padding: '28px 32px' }} id="printable-report">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Skeleton height="60px" />
              <Skeleton height="140px" />
              <Skeleton height="160px" />
            </div>
          ) : error ? (
            <ErrorState message={error} />
          ) : report ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Document Banner */}
              <div
                style={{
                  borderBottom: '2px solid var(--border-medium)',
                  paddingBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Flame size={20} color="var(--brand-primary)" />
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      AgniDrishti Incident Briefing
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Satellite Thermal Anomaly Classification & Verification Service
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                    {report.report_id}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Generated: {new Date(report.generated_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Threat Priority Alert Banner */}
              <div
                style={{
                  backgroundColor:
                    report.hotspot.priority === 'HIGH'
                      ? 'var(--color-high-bg)'
                      : report.hotspot.priority === 'MEDIUM'
                      ? 'var(--color-medium-bg)'
                      : 'var(--color-low-bg)',
                  border: '1px solid',
                  borderColor:
                    report.hotspot.priority === 'HIGH'
                      ? 'var(--color-high-border)'
                      : report.hotspot.priority === 'MEDIUM'
                      ? 'var(--color-medium-border)'
                      : 'var(--color-low-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color:
                        report.hotspot.priority === 'HIGH'
                          ? 'var(--color-high)'
                          : report.hotspot.priority === 'MEDIUM'
                          ? 'var(--color-medium)'
                          : 'var(--color-low)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {report.hotspot.priority} PRIORITY &bull; {report.hotspot.classification}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {report.hotspot.priority_reason}
                  </div>
                </div>

                {report.hotspot.industrial_status && report.hotspot.industrial_status !== 'NOT_APPLICABLE' && (
                  <span className="badge" style={{ backgroundColor: '#1e293b', color: '#93c5fd' }}>
                    {report.hotspot.industrial_status.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Core Hotspot Telemetry Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Coordinates: </span>
                  <b style={{ color: '#ffffff' }} className="font-mono">{report.hotspot.coordinates}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Observation Time: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.acq_datetime}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Radiative Power (FRP): </span>
                  <b style={{ color: 'var(--brand-primary)' }} className="font-mono">{report.hotspot.frp}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Detection Confidence: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.confidence}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Nearest Facility: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.nearest_facility}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Distance to Facility: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.facility_distance}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Surrounding Land Cover: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.land_cover}</b>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Spatial Clustering: </span>
                  <b style={{ color: '#ffffff' }}>{report.hotspot.cluster_info}</b>
                </div>
              </div>

              {/* Evidence Audit Section */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
                  Multi-Spectral Evidence Analysis
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  {report.evidence_summary}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {report.supporting_evidence.map((ev, i) => (
                    <div
                      key={`sup-${i}`}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--color-low-border)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={14} color="var(--color-low)" />
                      <span>{ev}</span>
                    </div>
                  ))}

                  {report.counter_evidence.map((ev, i) => (
                    <div
                      key={`cnt-${i}`}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--color-medium-border)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertTriangle size={14} color="var(--color-medium)" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Recommendation Box */}
              <div
                style={{
                  borderLeft: '4px solid var(--brand-primary)',
                  backgroundColor: 'rgba(255, 87, 34, 0.06)',
                  padding: '14px 18px',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Recommended Operational Directive
                </div>
                <div style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.4 }}>
                  {report.recommended_action}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
