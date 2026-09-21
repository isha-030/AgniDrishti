import React from 'react';
import {
  Flame,
  LayoutDashboard,
  Map,
  AlertTriangle,
  Building2,
  BarChart3,
  Settings,
  User,
  Activity,
} from 'lucide-react';
import type { PageType } from '../../types';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  alertCount?: number;
  systemStatus?: string;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  alertCount = 0,
  systemStatus = 'ONLINE',
  onOpenSettings,
}) => {
  const navItems = [
    { id: 'dashboard' as PageType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map' as PageType, label: 'Live Map', icon: Map },
    { id: 'alerts' as PageType, label: 'Alerts', icon: AlertTriangle, badge: alertCount },
    { id: 'facilities' as PageType, label: 'Facilities', icon: Building2 },
    { id: 'analytics' as PageType, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ff4500 0%, #ff8c00 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255, 69, 0, 0.4)',
            flexShrink: 0,
          }}
        >
          <Flame size={22} color="#ffffff" />
        </div>
        <div>
          <h1
            style={{
              fontSize: '16px',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: '#ffffff',
              lineHeight: 1.2,
            }}
          >
            AgniDrishti
          </h1>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontWeight: '500',
              letterSpacing: '0.02em',
            }}
          >
            See Beyond the Heat
          </p>
        </div>
      </div>

      {/* Primary 5 Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: '600',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 10px 8px 10px',
          }}
        >
          Intelligence Workspace
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-subtle)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon
                  size={18}
                  color={isActive ? 'var(--brand-primary)' : 'currentColor'}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--color-high)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status, User Profile & Settings */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Live Health Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '4px 6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  systemStatus === 'ONLINE' ? 'var(--color-low)' : 'var(--color-medium)',
                boxShadow:
                  systemStatus === 'ONLINE'
                    ? '0 0 8px rgba(16, 185, 129, 0.8)'
                    : 'none',
              }}
            />
            <span style={{ fontWeight: 500 }}>System {systemStatus}</span>
          </div>
          <Activity size={14} color="var(--text-muted)" />
        </div>

        {/* Profile & Settings action bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={16} color="var(--text-secondary)" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                GIS Analyst
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Command Center
              </div>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            title="Open Settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
