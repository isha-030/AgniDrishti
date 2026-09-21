/**
 * AgniDrishti Frontend Type Definitions
 * Directly aligned with backend Pydantic models and REST API schemas.
 */

export type PageType = 'dashboard' | 'map' | 'alerts' | 'facilities' | 'analytics';

export type ClassificationCategory = 'INDUSTRIAL' | 'NATURAL' | 'UNCERTAIN';
export type IndustrialStatus = 'KNOWN_EXPECTED' | 'NEW_ANOMALOUS' | 'NOT_APPLICABLE';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FacilityInfo {
  osm_id?: string;
  name: string;
  facility_type: string;
  distance_meters: number;
  is_hazardous: boolean;
  tags?: Record<string, string>;
}

export interface LandCoverContext {
  dominant_type: string;
  confidence: number;
  description: string;
  source: string;
}

export interface BaselineComparison {
  current_frp: number;
  baseline_mean_frp?: number;
  baseline_std_frp?: number;
  frp_ratio?: number;
  z_score?: number;
  status: IndustrialStatus;
  explanation: string;
}

export interface EvidenceItem {
  factor: string;
  signal: 'SUPPORT' | 'COUNTER' | 'NEUTRAL';
  weight: number;
  description: string;
}

export interface EvidenceReport {
  supporting_evidence: EvidenceItem[];
  counter_evidence: EvidenceItem[];
  net_score: number;
  has_conflicts: boolean;
  summary: string;
}

export interface ClusterInfo {
  cluster_id: number;
  size: number;
  total_frp: number;
  mean_frp: number;
  centroid_lat: number;
  centroid_lon: number;
  bbox: number[];
}

export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  acq_datetime: string;
  frp: number;
  confidence?: string | number;
  daynight?: string;
  satellite?: string;
  cluster: ClusterInfo;
  nearest_facility?: FacilityInfo;
  land_cover: LandCoverContext;
  baseline_comparison: BaselineComparison;
  classification: ClassificationCategory;
  industrial_status: IndustrialStatus;
  classification_confidence: number;
  priority: PriorityLevel;
  priority_reason: string;
  evidence_report: EvidenceReport;
  geojson_feature?: any;
}

export interface AlertListItem {
  id: string;
  latitude: number;
  longitude: number;
  acq_datetime: string;
  frp: number;
  confidence?: string | number;
  daynight?: string;
  satellite?: string;
  classification: ClassificationCategory;
  industrial_status: IndustrialStatus;
  priority: PriorityLevel;
  priority_reason: string;
  facility_name?: string;
  facility_distance_m?: number;
  land_cover: string;
  cluster_id: number;
  marker_color: string;
}

export interface DashboardSummary {
  total_hotspots: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  industrial: number;
  natural: number;
  uncertain: number;
  clusters_count: number;
  last_updated?: string | null;
  system_status: string;
}

export interface FacilitySummary {
  name: string;
  facility_type: string;
  latitude: number;
  longitude: number;
  is_hazardous: boolean;
  detections_count: number;
  mean_frp: number;
  max_frp: number;
  latest_detection: string;
  latest_status: string;
  latest_priority: string;
  baseline_mean?: number | null;
  baseline_recurrence?: number | null;
  min_distance_m: number;
}

export interface FacilityDetail {
  name: string;
  facility_type: string;
  latitude: number;
  longitude: number;
  is_hazardous: boolean;
  baseline_mean?: number | null;
  baseline_recurrence?: number | null;
  detections_count: number;
  mean_frp: number;
  max_frp: number;
  hotspots: string[];
}

export interface AnalyticsTrendItem {
  date: string;
  count: number;
  total_frp: number;
  avg_frp: number;
  industrial: number;
  natural: number;
  uncertain: number;
}

export interface AnalyticsData {
  total_hotspots: number;
  clusters_count: number;
  classification_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  hotspot_trend: AnalyticsTrendItem[];
  frp_distribution: Record<string, number>;
  diurnal_distribution: Record<string, number>;
  top_facilities: Array<{ name: string; count: number }>;
}

export interface IncidentReport {
  report_id: string;
  generated_at: string;
  hotspot: {
    id: string;
    coordinates: string;
    acq_datetime: string;
    frp: string;
    confidence: string;
    classification: string;
    industrial_status: string;
    priority: string;
    priority_reason: string;
    nearest_facility: string;
    facility_distance: string;
    land_cover: string;
    cluster_info: string;
  };
  evidence_summary: string;
  supporting_evidence: string[];
  counter_evidence: string[];
  baseline_summary: string;
  recommended_action: string;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  metadata?: {
    total_hotspots: number;
    generated_at?: string;
  };
  features: any[];
}
