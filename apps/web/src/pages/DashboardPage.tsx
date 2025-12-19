import { useEffect, useState } from 'react';
import { api, ApiClientError, NetworkError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SkeletonCard } from '../components/Skeleton';
import { StatusDonutChart } from '../components/charts/StatusDonutChart';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { SponsorTypeBarChart } from '../components/charts/SponsorTypeBarChart';

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

// Temporary mock data for charts (will be replaced with API calls in next slice)
const mockTimeSeriesData = [
  { month: '2024-01', submissions: 8, awards: 3, awardedAmount: 450000 },
  { month: '2024-02', submissions: 12, awards: 5, awardedAmount: 620000 },
  { month: '2024-03', submissions: 10, awards: 4, awardedAmount: 580000 },
  { month: '2024-04', submissions: 15, awards: 6, awardedAmount: 750000 },
  { month: '2024-05', submissions: 11, awards: 5, awardedAmount: 690000 },
  { month: '2024-06', submissions: 9, awards: 4, awardedAmount: 520000 },
  { month: '2024-07', submissions: 13, awards: 7, awardedAmount: 810000 },
  { month: '2024-08', submissions: 14, awards: 6, awardedAmount: 780000 },
  { month: '2024-09', submissions: 10, awards: 5, awardedAmount: 640000 },
  { month: '2024-10', submissions: 12, awards: 6, awardedAmount: 720000 },
  { month: '2024-11', submissions: 11, awards: 5, awardedAmount: 680000 },
  { month: '2024-12', submissions: 9, awards: 4, awardedAmount: 550000 },
];

const mockSponsorTypeData = [
  { sponsorType: 'Federal', awardedAmount: 2500000, count: 35 },
  { sponsorType: 'State', awardedAmount: 800000, count: 12 },
  { sponsorType: 'Foundation', awardedAmount: 600000, count: 8 },
  { sponsorType: 'Corporate', awardedAmount: 400000, count: 5 },
];

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
      let message = 'Failed to load metrics';
      if (err instanceof NetworkError) {
        message = err.message;
      } else if (err instanceof ApiClientError) {
        message = err.message;
      }
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

      {/* Visual Insights Section */}
      <div
        style={{
          marginTop: '2rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '1.5rem',
          }}
        >
          Visual Insights
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Status Distribution Donut Chart */}
          {statusBreakdown.length > 0 && (
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
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '1rem',
                }}
              >
                Grant Status Distribution
              </h3>
              <StatusDonutChart data={statusBreakdown} />
            </div>
          )}

          {/* Time Series Chart */}
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
                fontSize: '1rem',
                fontWeight: '600',
                color: '#333',
                marginBottom: '1rem',
              }}
            >
              Submissions vs Awards Over Time
            </h3>
            <TimeSeriesChart data={mockTimeSeriesData} />
          </div>
        </div>

        {/* Sponsor Type Bar Chart */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            marginTop: '1.5rem',
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Awarded Amount by Sponsor Type
          </h3>
          <SponsorTypeBarChart data={mockSponsorTypeData} />
        </div>
      </div>
    </div>
  );
}
