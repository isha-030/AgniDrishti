/**
 * api.ts - Centralized API Service for AgniDrishti.
 * Connects directly to FastAPI backend without hardcoded data.
 */

import type {
  AlertListItem,
  AnalyticsData,
  DashboardSummary,
  FacilityDetail,
  FacilitySummary,
  GeoJSONFeatureCollection,
  Hotspot,
  IncidentReport,
} from '../types';

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If not running on localhost/127.0.0.1 and not running on the backend web service directly,
    // route API requests to the live Render backend Web Service
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== 'agnidrishti-okjq.onrender.com') {
      return 'https://agnidrishti-okjq.onrender.com/api';
    }
  }
  return '/api';
}

const BASE_URL = getApiBaseUrl();

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${cleanPath}`;
  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText || response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('application/geo+json')) {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
      throw new Error(`Backend is starting up or returned an HTML error page. Please retry in a few moments.`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
  }

  return response.json();
}

export const api = {
  /** Retrieves high-level operational KPIs for the Dashboard header */
  async getDashboardSummary(): Promise<DashboardSummary> {
    return fetchJson<DashboardSummary>('/dashboard/summary');
  },

  /** Retrieves full GeoJSON FeatureCollection with styled markers and popups */
  async getHotspotsGeoJSON(useDemo = false): Promise<GeoJSONFeatureCollection> {
    return fetchJson<GeoJSONFeatureCollection>(`/hotspots/geojson?use_demo=${useDemo}`);
  },

  /** Retrieves DBSCAN spatial cluster polygons and aggregate stats */
  async getClusters(): Promise<any> {
    return fetchJson<any>('/clusters');
  },

  /** Retrieves filterable and searchable alerts for the Alerts page */
  async getAlerts(params: {
    priority?: string;
    classification?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ total: number; limit: number; offset: number; alerts: AlertListItem[] }> {
    const query = new URLSearchParams();
    if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params.classification && params.classification !== 'ALL') query.append('classification', params.classification);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', String(params.limit));
    if (params.offset) query.append('offset', String(params.offset));

    return fetchJson(`/alerts?${query.toString()}`);
  },

  /** Retrieves complete intelligence analysis for a single hotspot alert */
  async getAlertDetail(alertId: string): Promise<Hotspot> {
    return fetchJson<Hotspot>(`/alerts/${encodeURIComponent(alertId)}`);
  },

  /** Retrieves industrial facilities catalog with associated thermal stats */
  async getFacilities(): Promise<{ total_facilities: number; facilities: FacilitySummary[] }> {
    return fetchJson<{ total_facilities: number; facilities: FacilitySummary[] }>('/facilities');
  },

  /** Retrieves facility details and associated detection IDs */
  async getFacilityDetail(facilityName: string): Promise<FacilityDetail> {
    return fetchJson<FacilityDetail>(`/facilities/${encodeURIComponent(facilityName)}`);
  },

  /** Retrieves time-series, classification, priority, and thermal metrics */
  async getAnalytics(): Promise<AnalyticsData> {
    return fetchJson<AnalyticsData>('/analytics');
  },

  /** Generates structured incident report payload for PDF or JSON export */
  async generateReport(hotspotId: string): Promise<IncidentReport> {
    return fetchJson<IncidentReport>('/report/generate', {
      method: 'POST',
      body: JSON.stringify({ hotspot_id: hotspotId }),
    });
  },

  /** Runs the benchmark demonstration dataset */
  async triggerDemo(): Promise<any> {
    return fetchJson('/demo');
  },

  /** Uploads a NASA FIRMS CSV/JSON file to the backend */
  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const fullUrl = `${BASE_URL}/upload`;
    const response = await fetch(fullUrl, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }
    return response.json();
  },
};
