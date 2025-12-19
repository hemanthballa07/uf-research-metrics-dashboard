import { useEffect, useState } from 'react';
import { api, ApiClientError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SkeletonCard } from '../components/Skeleton';

interface MetricsSummary {
  totalSubmissions: number;
  totalAwardedAmount: number;
  awardRate: number;
  medianTimeToAward: number | null;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsData, breakdownData] = await Promise.all([
        api.getMetricsSummary(),
        api.getStatusBreakdown(),
      ]);
      setMetrics(metricsData);
      setStatusBreakdown(breakdownData);
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
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#999',
      submitted: '#4a9eff',
      under_review: '#ffa500',
      awarded: '#28a745',
      declined: '#dc3545',
    };
    return colors[status] || '#666';
  };

  const formatStatusLabel = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const totalStatusCount = statusBreakdown.reduce((sum, item) => sum + item.count, 0);

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

      {/* Status Breakdown Chart */}
      {statusBreakdown.length > 0 && (
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            marginBottom: '2rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '1.5rem',
            }}
          >
            Grant Status Breakdown
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {statusBreakdown.map((item) => {
              const percentage = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
              return (
                <div key={item.status}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: '#333',
                        textTransform: 'capitalize',
                      }}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '500',
                      }}
                    >
                      {item.count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '24px',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: getStatusColor(item.status),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
