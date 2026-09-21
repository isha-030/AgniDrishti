import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Flame,
  Sun,
  Moon,
  PieChart,
} from 'lucide-react';
import { api } from '../../services/api';
import type { AnalyticsData } from '../../types';
import { Skeleton, ErrorState } from '../../components/common/States';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAnalytics();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      setError(err.message || 'Failed to fetch analytics metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Skeleton height="120px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <Skeleton height="280px" />
          <Skeleton height="280px" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px' }}>
        <ErrorState message={error || 'No analytics data available'} onRetry={fetchAnalytics} />
      </div>
    );
  }

  // Calculate totals and percentages
  const total = data.total_hotspots || 1;
  const industrialCount = data.classification_distribution['INDUSTRIAL'] || 0;
  const naturalCount = data.classification_distribution['NATURAL'] || 0;
  const uncertainCount = data.classification_distribution['UNCERTAIN'] || 0;

  const highPriority = data.priority_distribution['HIGH'] || 0;
  const medPriority = data.priority_distribution['MEDIUM'] || 0;
  const lowPriority = data.priority_distribution['LOW'] || 0;

  // Max daily count for trend bar scaling
  const maxDayCount = Math.max(
    1,
    ...data.hotspot_trend.map((d) => d.count)
  );

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
          Thermal Activity Analytics & Trends
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Aggregated temporal patterns, classification distributions, and radiative energy profiles.
        </p>
      </div>

      {/* Temporal Trend Chart Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
              Daily Observation Trend
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Hotspot detection frequency over time categorized by thermal source.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ff7043' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Industrial</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--color-low)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Natural</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#64748b' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Uncertain</span>
            </div>
          </div>
        </div>

        {/* CSS Bar Chart */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            height: '180px',
            paddingTop: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {data.hotspot_trend.map((day) => {
            const heightPercent = Math.max(8, (day.count / maxDayCount) * 100);
            return (
              <div
                key={day.date}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }} className="font-mono">
                  {day.count}
                </div>
                {/* Stacked bar */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '42px',
                    height: `${heightPercent}%`,
                    borderRadius: '4px 4px 0 0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                  title={`${day.date}: ${day.count} total (${day.industrial} industrial, ${day.natural} natural, ${day.uncertain} uncertain)`}
                >
                  <div
                    style={{
                      height: `${(day.industrial / (day.count || 1)) * 100}%`,
                      backgroundColor: '#ff7043',
                    }}
                  />
                  <div
                    style={{
                      height: `${(day.natural / (day.count || 1)) * 100}%`,
                      backgroundColor: 'var(--color-low)',
                    }}
                  />
                  <div
                    style={{
                      height: `${(day.uncertain / (day.count || 1)) * 100}%`,
                      backgroundColor: '#64748b',
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid of Breakdowns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Source Classification Distribution */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PieChart size={16} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
              Source Classification Distribution
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Industrial */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Industrial Facilities & Flares</span>
                <span className="font-mono">
                  <b>{industrialCount}</b> ({((industrialCount / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(industrialCount / total) * 100}%`, height: '100%', backgroundColor: '#ff7043' }} />
              </div>
            </div>

            {/* Natural */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Natural / Forest / Agriculture</span>
                <span className="font-mono">
                  <b>{naturalCount}</b> ({((naturalCount / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(naturalCount / total) * 100}%`, height: '100%', backgroundColor: 'var(--color-low)' }} />
              </div>
            </div>

            {/* Uncertain */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uncertain (Under Verification)</span>
                <span className="font-mono">
                  <b>{uncertainCount}</b> ({((uncertainCount / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(uncertainCount / total) * 100}%`, height: '100%', backgroundColor: '#64748b' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Priority Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={16} color="var(--color-high)" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
              Operational Priority Breakdown
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* High Priority */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--color-high)' }}>High Priority (Immediate Action)</span>
                <span className="font-mono">
                  <b>{highPriority}</b> ({((highPriority / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(highPriority / total) * 100}%`, height: '100%', backgroundColor: 'var(--color-high)' }} />
              </div>
            </div>

            {/* Medium Priority */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--color-medium)' }}>Medium Priority (Regular Surveillance)</span>
                <span className="font-mono">
                  <b>{medPriority}</b> ({((medPriority / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(medPriority / total) * 100}%`, height: '100%', backgroundColor: 'var(--color-medium)' }} />
              </div>
            </div>

            {/* Low Priority */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--color-low)' }}>Low Priority (Standard / Expected)</span>
                <span className="font-mono">
                  <b>{lowPriority}</b> ({((lowPriority / total) * 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(lowPriority / total) * 100}%`, height: '100%', backgroundColor: 'var(--color-low)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Radiative Power (FRP) Distribution */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Flame size={16} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
              Radiative Power (FRP) Buckets
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(data.frp_distribution).map(([bucket, count]) => (
              <div key={bucket} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{bucket}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '120px',
                      height: '6px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (count / total) * 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--brand-primary)',
                      }}
                    />
                  </div>
                  <span className="font-mono" style={{ width: '40px', textAlign: 'right' }}>
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diurnal Cycle & Top Facilities */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sun size={16} color="var(--color-medium)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                Diurnal Satellite Overpasses
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Sun size={20} color="#f59e0b" />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day Passes</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {data.diurnal_distribution['Day'] || 0}
                  </div>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Moon size={20} color="#818cf8" />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Night Passes</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                    {data.diurnal_distribution['Night'] || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
              Top Monitored Industrial Sites
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {data.top_facilities.slice(0, 4).map((fac) => (
                <div
                  key={fac.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                    {fac.name}
                  </span>
                  <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>
                    {fac.count} detections
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
