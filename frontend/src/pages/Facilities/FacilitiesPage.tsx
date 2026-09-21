import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';
import type { FacilitySummary } from '../../types';
import { Skeleton, EmptyState, ErrorState } from '../../components/common/States';

interface FacilitiesPageProps {
  onSelectFacility: (facilityName: string) => void;
  onFilterAlertsByFacility: (facilityName: string) => void;
}

export const FacilitiesPage: React.FC<FacilitiesPageProps> = ({
  onSelectFacility,
  onFilterAlertsByFacility,
}) => {
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const fetchFacilities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getFacilities();
      setFacilities(res.facilities);
    } catch (err: any) {
      console.error('Failed to fetch facilities:', err);
      setError(err.message || 'Failed to fetch facilities catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      if (typeFilter !== 'ALL' && fac.facility_type.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          fac.name.toLowerCase().includes(q) ||
          fac.facility_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, typeFilter, searchQuery]);

  // Unique facility types
  const facilityTypes = useMemo(() => {
    const set = new Set<string>();
    facilities.forEach((f) => set.add(f.facility_type));
    return Array.from(set);
  }, [facilities]);

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
              Industrial Facilities Catalog
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              High-priority refineries, chemical complexes, and power installations under continuous thermal surveillance.
            </p>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            <b>{filteredFacilities.length}</b> facilities monitored
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
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '10px' }}
            />
            <input
              type="text"
              placeholder="Search facility name or type (e.g., Refinery, Hazira)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ width: '100%', paddingLeft: '34px', fontSize: '13px' }}
            />
          </div>

          {/* Type Dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input"
            style={{ width: '180px', fontSize: '12px' }}
          >
            <option value="ALL">All Facility Types</option>
            {facilityTypes.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>

          {(typeFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Facilities Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={fetchFacilities} />
          </div>
        ) : filteredFacilities.length === 0 ? (
          <EmptyState
            title="No facilities found"
            message="No monitored facilities match your search query."
            actionText="Clear Search"
            onAction={() => {
              setSearchQuery('');
              setTypeFilter('ALL');
            }}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Facility Name</th>
                  <th style={{ width: '140px' }}>Facility Type</th>
                  <th style={{ width: '130px' }}>Detections</th>
                  <th style={{ width: '130px' }}>Mean FRP</th>
                  <th style={{ width: '130px' }}>Max FRP</th>
                  <th style={{ width: '150px' }}>Baseline Mean</th>
                  <th style={{ width: '150px' }}>Coordinates</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((fac) => (
                  <tr
                    key={fac.name}
                    onClick={() => onSelectFacility(fac.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(139, 92, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#a78bfa',
                            flexShrink: 0,
                          }}
                        >
                          <Building2 size={15} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{fac.name}</div>
                          {fac.is_hazardous && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--color-high)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <ShieldAlert size={10} />
                              Hazardous Site
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          color: '#c4b5fd',
                          borderColor: 'rgba(139, 92, 246, 0.3)',
                        }}
                      >
                        {fac.facility_type.toUpperCase()}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, color: '#ffffff' }}>
                        {fac.detections_count}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                        {fac.mean_frp ? fac.mean_frp.toFixed(1) : 0}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MW</span>
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ color: 'var(--color-high)' }}>
                        {fac.max_frp ? fac.max_frp.toFixed(1) : 0}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MW</span>
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {fac.baseline_mean !== null && fac.baseline_mean !== undefined
                          ? `${fac.baseline_mean.toFixed(1)} MW`
                          : '—'}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {fac.latitude.toFixed(3)}°, {fac.longitude.toFixed(3)}°
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onFilterAlertsByFacility(fac.name)}
                          className="btn btn-ghost btn-sm"
                          title="View Related Alerts"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          <span>Alerts ({fac.detections_count})</span>
                        </button>
                        <button
                          onClick={() => onSelectFacility(fac.name)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          <span>Inspect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
