import { useEffect, useState } from 'react';
import { api, ApiClientError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';

interface MetricsSummary {
  totalSubmissions: number;
  totalAwardedAmount: number;
  awardRate: number;
  medianTimeToAward: number | null;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMetricsSummary();
      setMetrics(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Failed to load metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchMetrics} />;
  }

  if (!metrics) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDays = (days: number | null) => {
    if (days === null) return 'N/A';
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', color: '#1a1a1a' }}>
        Research Metrics Dashboard
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {/* Total Submissions Card */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              color: '#666',
              marginBottom: '0.5rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Total Submissions
          </h3>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            {metrics.totalSubmissions.toLocaleString()}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem', margin: 0 }}>
            Last 12 months
          </p>
        </div>

        {/* Total Awarded Amount Card */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              color: '#666',
              marginBottom: '0.5rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Total Awarded
          </h3>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            {formatCurrency(metrics.totalAwardedAmount)}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem', margin: 0 }}>
            Last 12 months
          </p>
        </div>

        {/* Award Rate Card */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              color: '#666',
              marginBottom: '0.5rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Award Rate
          </h3>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            {metrics.awardRate.toFixed(2)}%
          </p>
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem', margin: 0 }}>
            Success rate
          </p>
        </div>

        {/* Median Time to Award Card */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              color: '#666',
              marginBottom: '0.5rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Median Time to Award
          </h3>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            {formatDays(metrics.medianTimeToAward)}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem', margin: 0 }}>
            For awarded grants
          </p>
        </div>
      </div>
    </div>
  );
}
