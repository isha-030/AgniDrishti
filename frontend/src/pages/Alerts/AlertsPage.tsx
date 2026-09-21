import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api';
import type { AlertListItem } from '../../types';
import { Skeleton, EmptyState, ErrorState } from '../../components/common/States';

interface AlertsPageProps {
  onSelectAlert: (id: string) => void;
  onOpenReportModal: (id: string) => void;
  onLocateOnMap: (id: string) => void;
  initialPriority?: string;
  initialClassification?: string;
  initialSearch?: string;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onSelectAlert,
  onOpenReportModal,
  onLocateOnMap,
  initialPriority = 'ALL',
  initialClassification = 'ALL',
  initialSearch = '',
}) => {
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [classificationFilter, setClassificationFilter] = useState(initialClassification);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * pageSize;
      const res = await api.getAlerts({
        priority: priorityFilter,
        classification: classificationFilter,
        status: statusFilter,
        search: searchQuery,
        limit: pageSize,
        offset,
      });

      setAlerts(res.alerts);
      setTotalCount(res.total);
    } catch (err: any) {
      console.error('Failed to fetch alerts:', err);
      setError(err.message || 'Failed to fetch alerts from backend.');
    } finally {
      setLoading(false);
    }
  }, [page, priorityFilter, classificationFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAlerts();
  };

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Filter Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
              Thermal Alerts Registry
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Filtered feed of detected thermal anomalies with multi-spectral verification status.
            </p>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <b>{alerts.length}</b> of <b>{totalCount}</b> total events
          </div>
        </div>

        {/* Filter Controls Row */}
        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '10px' }}
            />
            <input
              type="text"
              placeholder="Search facility name, coordinates, land cover..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ width: '100%', paddingLeft: '34px', fontSize: '13px' }}
            />
          </form>

          {/* Classification Dropdown */}
          <select
            value={classificationFilter}
            onChange={(e) => {
              setClassificationFilter(e.target.value);
              setPage(1);
            }}
            className="input"
            style={{ width: '160px', fontSize: '12px' }}
          >
            <option value="ALL">All Classifications</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="NATURAL">Natural / Forest</option>
            <option value="UNCERTAIN">Uncertain / Triage</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="input"
            style={{ width: '140px', fontSize: '12px' }}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input"
            style={{ width: '160px', fontSize: '12px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="KNOWN_EXPECTED">Known Expected</option>
            <option value="NEW_ANOMALOUS">New Anomalous</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </select>

          {(priorityFilter !== 'ALL' || classificationFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setPriorityFilter('ALL');
                setClassificationFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
                setPage(1);
              }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table / Data Content */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="36px" />
            <Skeleton height="36px" />
            <Skeleton height="36px" />
            <Skeleton height="36px" />
            <Skeleton height="36px" />
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={fetchAlerts} />
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No alerts match the selected criteria"
            message="Try widening your search terms or resetting the classification and priority filters."
            actionText="Reset All Filters"
            onAction={() => {
              setPriorityFilter('ALL');
              setClassificationFilter('ALL');
              setStatusFilter('ALL');
              setSearchQuery('');
              setPage(1);
            }}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Priority</th>
                  <th>Facility / Context</th>
                  <th style={{ width: '110px' }}>FRP Intensity</th>
                  <th style={{ width: '140px' }}>Classification</th>
                  <th style={{ width: '140px' }}>Baseline Status</th>
                  <th style={{ width: '140px' }}>Detection Time</th>
                  <th style={{ width: '150px' }}>Coordinates</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const priorityClass =
                    alert.priority === 'HIGH'
                      ? 'badge-high'
                      : alert.priority === 'MEDIUM'
                      ? 'badge-medium'
                      : 'badge-low';

                  return (
                    <tr
                      key={alert.id}
                      onClick={() => onSelectAlert(alert.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${priorityClass}`} style={{ fontSize: '11px' }}>
                          {alert.priority}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>
                          {alert.facility_name || 'Isolated Area'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {alert.facility_distance_m !== undefined && alert.facility_distance_m !== null
                            ? `${Math.round(alert.facility_distance_m)}m away &bull; `
                            : ''}
                          {alert.land_cover}
                        </div>
                      </td>

                      <td>
                        <span className="font-mono" style={{ fontWeight: 600, color: '#ffffff' }}>
                          {alert.frp.toFixed(1)}{' '}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MW</span>
                        </span>
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            fontSize: '11px',
                            backgroundColor:
                              alert.classification === 'INDUSTRIAL'
                                ? 'rgba(255, 87, 34, 0.12)'
                                : alert.classification === 'NATURAL'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(107, 114, 128, 0.12)',
                            color:
                              alert.classification === 'INDUSTRIAL'
                                ? '#ff7043'
                                : alert.classification === 'NATURAL'
                                ? 'var(--color-low)'
                                : 'var(--text-secondary)',
                            borderColor:
                              alert.classification === 'INDUSTRIAL'
                                ? 'rgba(255, 87, 34, 0.3)'
                                : alert.classification === 'NATURAL'
                                ? 'var(--color-low-border)'
                                : 'var(--border-subtle)',
                          }}
                        >
                          {alert.classification}
                        </span>
                      </td>

                      <td>
                        {alert.industrial_status && alert.industrial_status !== 'NOT_APPLICABLE' ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: '10px',
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
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(alert.acq_datetime).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(alert.acq_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td>
                        <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {alert.latitude.toFixed(3)}°, {alert.longitude.toFixed(3)}°
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onLocateOnMap(alert.id)}
                            className="btn btn-ghost btn-sm"
                            title="Locate On Map"
                            style={{ padding: '6px' }}
                          >
                            <MapPin size={14} />
                          </button>
                          <button
                            onClick={() => onOpenReportModal(alert.id)}
                            className="btn btn-ghost btn-sm"
                            title="Generate Incident Report"
                            style={{ padding: '6px' }}
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            onClick={() => onSelectAlert(alert.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 10px' }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 10px' }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
