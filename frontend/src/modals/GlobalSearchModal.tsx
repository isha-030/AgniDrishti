import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, Flame, X, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import type { AlertListItem, FacilitySummary } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlert: (id: string) => void;
  onSelectFacility: (name: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAlert,
  onSelectFacility,
}) => {
  const [query, setQuery] = useState('');
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setAlerts([]);
      setFacilities([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setAlerts([]);
      setFacilities([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [alertRes, facRes] = await Promise.all([
          api.getAlerts({ search: query, limit: 5 }),
          api.getFacilities(),
        ]);

        setAlerts(alertRes.alerts);

        const q = query.toLowerCase();
        const matchedFacs = facRes.facilities.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.facility_type.toLowerCase().includes(q)
        ).slice(0, 5);

        setFacilities(matchedFacs);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '600px', padding: '0', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <Search size={18} color="var(--brand-primary)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search industrial facilities, coordinates, land cover..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '15px',
            }}
          />
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '12px' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Searching telemetry database...
            </div>
          )}

          {!loading && !query.trim() && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Type a facility name (e.g., <i>"Jamnagar"</i>, <i>"Refinery"</i>) or coordinate to find matches.
            </div>
          )}

          {!loading && query.trim() && facilities.length === 0 && alerts.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No facilities or alerts matched <b>"{query}"</b>.
            </div>
          )}

          {/* Facilities Results Group */}
          {facilities.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                }}
              >
                Industrial Facilities ({facilities.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {facilities.map((fac) => (
                  <div
                    key={fac.name}
                    onClick={() => {
                      onSelectFacility(fac.name);
                      onClose();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building2 size={16} color="#a78bfa" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                          {fac.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {fac.facility_type.toUpperCase()} &bull; {fac.detections_count} detections &bull; Mean {fac.mean_frp ? fac.mean_frp.toFixed(1) : 0} MW
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts Results Group */}
          {alerts.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                }}
              >
                Hotspot Detections ({alerts.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      onSelectAlert(alert.id);
                      onClose();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Flame size={16} color="var(--brand-primary)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                          {alert.facility_name || 'Isolated Area'} ({alert.frp.toFixed(1)} MW)
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {alert.priority} PRIORITY &bull; {alert.latitude.toFixed(3)}°, {alert.longitude.toFixed(3)}° &bull; {new Date(alert.acq_datetime).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: '10px' }}>
                      {alert.classification}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
