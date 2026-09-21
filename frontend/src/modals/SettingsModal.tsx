import React, { useState } from 'react';
import { X, Settings, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataReset?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDataReset,
}) => {
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunDemo = async () => {
    try {
      setDemoLoading(true);
      setDemoSuccess(null);
      const res = await api.triggerDemo();
      setDemoSuccess(`Demo analysis completed: ${res.total_hotspots} hotspots ingested.`);
      if (onDataReset) onDataReset();
    } catch (err: any) {
      alert(`Demo execution failed: ${err.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '560px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--brand-primary)" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
              System & Pipeline Settings
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Pipeline Parameters */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Analytical Calibration
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Industrial Proximity Buffer</span>
                <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>2,500 meters</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Spatial Cluster Epsilon (DBSCAN)</span>
                <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>10.0 km</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Baseline Deviation Threshold</span>
                <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>&gt; 2.0 &sigma; (Z-Score)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>FRP High Anomaly Ratio</span>
                <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>&gt; 2.5x Baseline</span>
              </div>
            </div>
          </div>

          {/* NASA FIRMS Integration Status */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              NASA FIRMS Sensor Telemetry
            </h4>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid var(--color-low-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--color-low)" />
                <span style={{ fontSize: '13px', color: '#ffffff' }}>NASA MAP_KEY Configured</span>
              </div>
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                e42c93c1...87a
              </span>
            </div>
          </div>

          {/* Test Benchmark / Demo Re-run */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Benchmark Verification
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Run the verified benchmark dataset through all pipeline stages (clustering, enrichment, baseline, classification).
            </p>

            <button
              onClick={handleRunDemo}
              disabled={demoLoading}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%' }}
            >
              <RefreshCw size={14} className={demoLoading ? 'spin-anim' : ''} />
              <span>{demoLoading ? 'Executing Benchmark Pipeline...' : 'Run Benchmark Test Pipeline'}</span>
            </button>

            {demoSuccess && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-low)' }}>
                ✓ {demoSuccess}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
