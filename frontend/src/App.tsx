import React, { useState, useEffect, useCallback } from 'react';
import type { PageType, DashboardSummary, Hotspot } from './types';
import { api } from './services/api';

// Layout
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// 5 Primary Pages
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { LiveMapPage } from './pages/LiveMap/LiveMapPage';
import { AlertsPage } from './pages/Alerts/AlertsPage';
import { FacilitiesPage } from './pages/Facilities/FacilitiesPage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';

// Overlays & Drawers
import { AlertDetailsDrawer } from './drawers/AlertDetailsDrawer';
import { FacilityDetailsDrawer } from './drawers/FacilityDetailsDrawer';
import { GenerateReportModal } from './modals/GenerateReportModal';
import { GlobalSearchModal } from './modals/GlobalSearchModal';
import { SettingsModal } from './modals/SettingsModal';

export const App: React.FC = () => {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drawer / Overlay States
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Hotspot | null>(null);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);

  const [selectedFacilityName, setSelectedFacilityName] = useState<string | null>(null);
  const [isFacilityDrawerOpen, setIsFacilityDrawerOpen] = useState(false);

  const [reportHotspotId, setReportHotspotId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter state for navigation cross-wiring
  const [alertsFilter, setAlertsFilter] = useState<{ priority?: string; classification?: string; search?: string }>({
    priority: 'ALL',
    classification: 'ALL',
    search: '',
  });

  // Fetch operational summary for sidebar badges & header sync info
  const fetchSummary = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to sync summary:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Load detailed hotspot when an alert is selected
  useEffect(() => {
    if (!selectedHotspotId) {
      setSelectedAlert(null);
      setIsAlertDrawerOpen(false);
      return;
    }

    const loadAlert = async () => {
      try {
        const detail = await api.getAlertDetail(selectedHotspotId);
        setSelectedAlert(detail);
        setIsAlertDrawerOpen(true);
      } catch (err) {
        console.error('Failed to load alert detail:', err);
      }
    };

    loadAlert();
  }, [selectedHotspotId]);

  // Handle Ctrl+K shortcut for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers for cross-page interactions
  const handleSelectHotspot = (id: string) => {
    setSelectedHotspotId(id);
  };

  const handleSelectFacility = (name: string) => {
    setSelectedFacilityName(name);
    setIsFacilityDrawerOpen(true);
  };

  const handleOpenReportModal = (id: string) => {
    setReportHotspotId(id);
    setIsReportModalOpen(true);
  };

  const handleNavigateToAlerts = (filter?: { priority?: string; classification?: string }) => {
    if (filter) {
      setAlertsFilter(filter);
    }
    setCurrentPage('alerts');
  };

  const handleLocateOnMap = (id: string) => {
    setSelectedHotspotId(id);
    setCurrentPage('map');
  };

  const handleFilterAlertsByFacility = (facilityName: string) => {
    setIsFacilityDrawerOpen(false);
    setAlertsFilter({ priority: 'ALL', classification: 'ALL', search: facilityName });
    setCurrentPage('alerts');
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        alertCount={summary?.high_priority ?? 0}
        systemStatus={summary?.system_status ?? 'ONLINE'}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Persistent Top Header */}
        <Header
          currentPage={currentPage}
          lastUpdated={summary?.last_updated}
          onRefresh={fetchSummary}
          isRefreshing={isRefreshing}
          onOpenSearch={() => setIsSearchOpen(true)}
          alertCount={summary?.high_priority ?? 0}
        />

        {/* Dynamic Page Container */}
        <main style={{ flex: 1, overflowY: currentPage === 'map' ? 'hidden' : 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigateToMap={() => setCurrentPage('map')}
              onNavigateToAlerts={handleNavigateToAlerts}
              onNavigateToFacilities={() => setCurrentPage('facilities')}
              onSelectAlert={handleSelectHotspot}
            />
          )}

          {currentPage === 'map' && (
            <LiveMapPage
              onSelectHotspot={handleSelectHotspot}
              selectedHotspotId={selectedHotspotId}
            />
          )}

          {currentPage === 'alerts' && (
            <AlertsPage
              onSelectAlert={handleSelectHotspot}
              onOpenReportModal={handleOpenReportModal}
              onLocateOnMap={handleLocateOnMap}
              initialPriority={alertsFilter.priority}
              initialClassification={alertsFilter.classification}
              initialSearch={alertsFilter.search}
            />
          )}

          {currentPage === 'facilities' && (
            <FacilitiesPage
              onSelectFacility={handleSelectFacility}
              onFilterAlertsByFacility={handleFilterAlertsByFacility}
            />
          )}

          {currentPage === 'analytics' && <AnalyticsPage />}
        </main>
      </div>

      {/* Overlays & Drawers (Non-primary navigation) */}
      <AlertDetailsDrawer
        alert={selectedAlert}
        isOpen={isAlertDrawerOpen}
        onClose={() => {
          setIsAlertDrawerOpen(false);
          setSelectedHotspotId(null);
        }}
        onOpenReportModal={handleOpenReportModal}
        onViewFacility={handleSelectFacility}
      />

      <FacilityDetailsDrawer
        facilityName={selectedFacilityName}
        isOpen={isFacilityDrawerOpen}
        onClose={() => {
          setIsFacilityDrawerOpen(false);
          setSelectedFacilityName(null);
        }}
        onViewAlerts={handleFilterAlertsByFacility}
        onSelectHotspot={handleSelectHotspot}
      />

      <GenerateReportModal
        hotspotId={reportHotspotId}
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportHotspotId(null);
        }}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAlert={handleSelectHotspot}
        onSelectFacility={handleSelectFacility}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataReset={fetchSummary}
      />
    </div>
  );
};

export default App;
