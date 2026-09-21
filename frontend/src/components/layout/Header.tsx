import React from 'react';
import { Search, RefreshCw, Bell } from 'lucide-react';
import type { PageType } from '../../types';

interface HeaderProps {
  currentPage: PageType;
  lastUpdated?: string | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onOpenSearch: () => void;
  alertCount?: number;
}

const pageTitles: Record<PageType, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Operational Dashboard',
    subtitle: 'Real-time satellite thermal anomaly overview & threat triage',
  },
  map: {
    title: 'GIS Intelligence Map',
    subtitle: 'Interactive multi-layer spatial analysis and 3D investigation workspace',
  },
  alerts: {
    title: 'Thermal Alerts Feed',
    subtitle: 'Detected anomalies, source classification, and baseline deviations',
  },
  facilities: {
    title: 'Industrial Facilities Catalog',
    subtitle: 'Monitored refineries, power stations, steelworks & petrochemical plants',
  },
  analytics: {
    title: 'Trends & Historical Analytics',
    subtitle: 'Aggregated thermal activity distributions and site baseline patterns',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  onOpenSearch,
  alertCount = 0,
}) => {
  const current = pageTitles[currentPage];

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff' }}>
          {current.title}
        </h2>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {current.subtitle}
        </p>
      </div>

      {/* Global Search & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Global Search Input trigger */}
        <button
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 14px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            width: '260px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-highlight)';
            e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-medium)';
            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
          }}
        >
          <Search size={15} color="var(--text-secondary)" />
          <span style={{ flex: 1, textAlign: 'left', color: 'var(--text-secondary)' }}>
            Search facilities, coordinates...
          </span>
          <kbd
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            Ctrl K
          </kbd>
        </button>

        {/* Sync Time indicator */}
        {lastUpdated && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Satellite Feed</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }} className="font-mono">
              {new Date(lastUpdated).toLocaleDateString()} {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Data from Backend"
          className="btn btn-secondary btn-sm"
          style={{ padding: '7px 12px' }}
        >
          <RefreshCw
            size={14}
            className={isRefreshing ? 'spin-anim' : ''}
            style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
          />
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Notification Bell with Badge */}
        <div style={{ position: 'relative' }}>
          <button
            title="Active High & Medium Alerts"
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
          >
            <Bell size={16} color="var(--text-secondary)" />
          </button>
          {alertCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-high)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              }}
            >
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
