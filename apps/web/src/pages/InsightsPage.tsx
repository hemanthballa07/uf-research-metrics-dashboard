import { useState } from 'react';

export function InsightsPage() {
  const [filters, setFilters] = useState({
    months: 12,
    departmentId: '',
    sponsorType: '',
    status: [] as string[],
  });

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
    // TODO: Apply filters and fetch data
    console.log('Applying filters:', filters);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page Header */}
      <div>
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
      </div>

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
              {/* TODO: Populate from API */}
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

      {/* KPI Strip Placeholder */}
      <div>
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
          {['Submissions', 'Awards', 'Award Rate', 'Total Awarded', 'Median Time-to-Award', 'Avg Award Size'].map(
            (kpi) => (
              <div
                key={kpi}
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: '1px solid #e0e0e0',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{kpi}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a' }}>--</div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>Sparkline placeholder</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Pipeline Over Time Placeholder */}
      <div>
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
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          Stacked Area Chart Placeholder
        </div>
      </div>

      {/* Heatmap Calendar Placeholder */}
      <div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#333',
            marginBottom: '1rem',
          }}
        >
          Grant Activity Heatmap
        </h2>
        <div
          style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          Heatmap Calendar Placeholder
        </div>
      </div>

      {/* Sponsor Treemap Placeholder */}
      <div>
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
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          Treemap / Bar Chart Placeholder
        </div>
      </div>

      {/* Department Comparison Placeholder */}
      <div>
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
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          Ranked Bar Chart + Drill-down Panel Placeholder
        </div>
      </div>

      {/* Flow Visualization Placeholder */}
      <div>
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
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          Status Flow Funnel Placeholder
        </div>
      </div>
    </div>
  );
}

