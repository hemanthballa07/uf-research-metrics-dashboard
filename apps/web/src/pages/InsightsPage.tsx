import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, ApiClientError, NetworkError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { KPITile } from '../components/insights/KPITile';
import { StackedAreaChart } from '../components/insights/StackedAreaChart';
import { ActivityHeatmap } from '../components/insights/ActivityHeatmap';
import { SponsorBarChart } from '../components/insights/SponsorBarChart';
import { DepartmentComparison } from '../components/insights/DepartmentComparison';
import { FlowFunnel } from '../components/insights/FlowFunnel';

interface InsightsData {
  summary: {
    submissions: number;
    awards: number;
    awardRate: number;
    totalAwardedAmount: number;
    medianTimeToAward: number | null;
    avgAwardSize: number;
  };
  timeseries: Array<{
    month: string;
    submissions: number;
    awards: number;
    awardedAmount: number;
    statusCounts: {
      draft: number;
      submitted: number;
      under_review: number;
      awarded: number;
      declined: number;
    };
  }>;
  dailyActivity: Array<{
    date: string;
    submissions: number;
    awards: number;
    awardedAmount: number;
  }>;
  sponsorBreakdown: Array<{
    name: string;
    sponsorType: string | null;
    awardedAmount: number;
    count: number;
  }>;
  departmentBreakdown: Array<{
    departmentId: number;
    name: string;
    awardedAmount: number;
    awards: number;
    submissions: number;
  }>;
  funnel: {
    submitted: number;
    underReview: number;
    awarded: number;
    declined: number;
  };
}

export function InsightsPage() {
  const [filters, setFilters] = useState({
    months: 12,
    departmentId: '',
    sponsorType: '',
    status: [] as string[],
  });
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [heatmapMetric, setHeatmapMetric] = useState<'submissions' | 'awards' | 'awardedAmount'>('submissions');

  // Load departments for dropdown
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await api.getDepartments();
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    loadDepartments();
  }, []);

  // Fetch insights data
  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: {
        months: number;
        departmentId?: number;
        sponsorType?: string;
        status?: string;
      } = {
        months: filters.months,
      };
      if (filters.departmentId) {
        params.departmentId = Number(filters.departmentId);
      }
      if (filters.sponsorType) {
        params.sponsorType = filters.sponsorType;
      }
      if (filters.status.length > 0) {
        params.status = filters.status.join(',');
      }
      const insightsData = await api.getInsights(params);
      setData(insightsData);
    } catch (err) {
      let message = 'Failed to load insights';
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
    fetchInsights();
  }, []); // Initial load

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      months: 12,
      departmentId: '',
      sponsorType: '',
      status: [],
    });
  };

  const handleApply = () => {
    fetchInsights();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !data) {
    return <LoadingSpinner />;
  }

  if (error && !data) {
    return <ErrorDisplay message={error} />;
  }

  // Extract sparkline data from timeseries
  const getSparklineData = (key: 'submissions' | 'awards' | 'awardedAmount') => {
    return data?.timeseries.map((point) => point[key]) || [];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
    >
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0,
            marginBottom: '0.5rem',
          }}
        >
          Insights
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: '#666',
            margin: 0,
          }}
        >
          Interactive analytics for grant activity and research productivity
        </p>
      </motion.div>

      {/* Filter Panel - Sticky */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          position: 'sticky',
          top: '1rem',
          zIndex: 100,
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#333',
            marginBottom: '1rem',
            marginTop: 0,
          }}
        >
          Filters
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          {/* Date Range */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#333',
                marginBottom: '0.5rem',
              }}
            >
              Date Range
            </label>
            <select
              value={filters.months}
              onChange={(e) => handleFilterChange('months', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </select>
          </div>

          {/* Department */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#333',
                marginBottom: '0.5rem',
              }}
            >
              Department
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => handleFilterChange('departmentId', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sponsor Type */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#333',
                marginBottom: '0.5rem',
              }}
            >
              Sponsor Type
            </label>
            <select
              value={filters.sponsorType}
              onChange={(e) => handleFilterChange('sponsorType', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Sponsor Types</option>
              <option value="federal">Federal</option>
              <option value="state">State</option>
              <option value="foundation">Foundation</option>
              <option value="corporate">Corporate</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Status Multi-select */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#333',
                marginBottom: '0.5rem',
              }}
            >
              Status
            </label>
            <select
              multiple
              value={filters.status}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                handleFilterChange('status', selected);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
                minHeight: '80px',
              }}
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="awarded">Awarded</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: '#333',
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4a9eff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: '500',
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Key Performance Indicators
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <KPITile
              title="Submissions"
              value={data.summary.submissions}
              sparklineData={getSparklineData('submissions')}
              delay={0.1}
            />
            <KPITile
              title="Awards"
              value={data.summary.awards}
              sparklineData={getSparklineData('awards')}
              delay={0.2}
            />
            <KPITile
              title="Award Rate"
              value={`${data.summary.awardRate.toFixed(1)}%`}
              sparklineData={getSparklineData('awards').map((a, i) => {
                const s = getSparklineData('submissions')[i];
                return s > 0 ? (a / s) * 100 : 0;
              })}
              delay={0.3}
            />
            <KPITile
              title="Total Awarded"
              value={formatCurrency(data.summary.totalAwardedAmount)}
              sparklineData={getSparklineData('awardedAmount')}
              delay={0.4}
            />
            <KPITile
              title="Median Time-to-Award"
              value={data.summary.medianTimeToAward ? `${data.summary.medianTimeToAward} days` : 'N/A'}
              delay={0.5}
            />
            <KPITile
              title="Avg Award Size"
              value={formatCurrency(data.summary.avgAwardSize)}
              delay={0.6}
            />
          </div>
        </motion.div>
      )}

      {/* Pipeline Over Time */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Pipeline Over Time
          </h2>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <StackedAreaChart
              data={data.timeseries.map((point) => ({
                month: point.month,
                submitted: point.statusCounts.submitted,
                under_review: point.statusCounts.under_review,
                awarded: point.statusCounts.awarded,
                declined: point.statusCounts.declined,
              }))}
            />
          </div>
        </motion.div>
      )}

      {/* Grant Activity Heatmap */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#333',
                margin: 0,
              }}
            >
              Grant Activity Heatmap
            </h2>
            <select
              value={heatmapMetric}
              onChange={(e) => setHeatmapMetric(e.target.value as 'submissions' | 'awards' | 'awardedAmount')}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="submissions">Submissions</option>
              <option value="awards">Awards</option>
              <option value="awardedAmount">Awarded Amount</option>
            </select>
          </div>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <ActivityHeatmap data={data.dailyActivity} metric={heatmapMetric} />
          </div>
        </motion.div>
      )}

      {/* Sponsor Breakdown */}
      {data && data.sponsorBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Sponsor Breakdown
          </h2>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <SponsorBarChart data={data.sponsorBreakdown} />
          </div>
        </motion.div>
      )}

      {/* Department Comparison */}
      {data && data.departmentBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Department Comparison
          </h2>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <DepartmentComparison
              data={data.departmentBreakdown}
              onDepartmentClick={setSelectedDepartment}
              selectedDepartment={selectedDepartment}
            />
          </div>
        </motion.div>
      )}

      {/* Grant Flow */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
              marginBottom: '1rem',
            }}
          >
            Grant Flow
          </h2>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <FlowFunnel data={data.funnel} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

