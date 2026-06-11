import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.js';
import type { ExpiryResponse, ExpiryBucket } from '@uf-research-metrics-platform/shared';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const BUCKET_CONFIG: Record<string, { color: string; label: string; bgColor: string }> = {
  '0-30':  { color: '#e53e3e', bgColor: '#fff5f5', label: 'Critical (≤30 days)' },
  '31-60': { color: '#dd6b20', bgColor: '#fffaf0', label: 'Watch (31–60 days)' },
  '61-90': { color: '#38a169', bgColor: '#f0fff4', label: 'Upcoming (61–90 days)' },
};

function daysColor(days: number): string {
  if (days <= 30) return '#e53e3e';
  if (days <= 60) return '#dd6b20';
  return '#38a169';
}

export function ExpiryPage() {
  const [data, setData] = useState<ExpiryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getExpiringGrants()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h2 style={{ marginBottom: '0.5rem' }}>Expiring Grants</h2>
        <div style={{ color: '#666' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 style={{ marginBottom: '0.5rem' }}>Expiring Grants</h2>
        <div style={{ color: '#e53e3e', padding: '1rem', backgroundColor: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allGrants = data.buckets.flatMap(b => b.grants);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.25rem' }}>Expiring Grants</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
          {data.totalCount} awarded grant{data.totalCount !== 1 ? 's' : ''} expiring within 90 days
          {data.totalCount > 0 ? ` · ${formatCurrency(data.totalAmount)} total` : ''}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {data.buckets.map((bucket: ExpiryBucket) => {
          const cfg = BUCKET_CONFIG[bucket.label];
          return (
            <div
              key={bucket.label}
              style={{
                backgroundColor: cfg.bgColor,
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                border: `1px solid ${cfg.color}33`,
                borderLeft: `4px solid ${cfg.color}`,
              }}
            >
              <h3 style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {cfg.label}
              </h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: cfg.color, margin: 0 }}>
                {bucket.count}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem', margin: 0 }}>
                {bucket.count > 0 ? formatCurrency(bucket.totalAmount) : 'No grants'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Grants Table */}
      {allGrants.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          No awarded grants expiring within 90 days.
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                {['Title', 'PI', 'Department', 'Sponsor', 'Amount', 'End Date', 'Days Left'].map(col => (
                  <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#333', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allGrants.map((grant, idx) => (
                <tr
                  key={grant.id}
                  style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                >
                  <td style={{ padding: '0.75rem 1rem', maxWidth: '280px' }}>
                    <span title={grant.title} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {grant.title}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{grant.pi?.name ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{grant.department?.name ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{grant.sponsor?.name ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{formatCurrency(grant.amount)}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{formatDate(grant.endAt)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      color: '#fff',
                      backgroundColor: daysColor(grant.daysUntilExpiry),
                    }}>
                      {grant.daysUntilExpiry}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
