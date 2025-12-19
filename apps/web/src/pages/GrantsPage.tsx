import { useState, useEffect, useMemo } from 'react';
import { api, ApiClientError, NetworkError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { GrantDrawer } from '../components/GrantDrawer';
import { useDebounce } from '../hooks/useDebounce';
import { SkeletonTable } from '../components/Skeleton';

type Grant = {
  id: number;
  title: string;
  amount: number;
  status: string;
  submittedAt: string | null;
  awardedAt: string | null;
  sponsor?: { id: number; name: string; sponsorType: string };
  pi?: { id: number; name: string; email: string; departmentId: number };
  department?: { id: number; name: string };
};

export function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter options
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [sponsors, setSponsors] = useState<Array<{ id: number; name: string; sponsorType: string }>>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>(undefined);
  const [sponsorFilter, setSponsorFilter] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 500);

  // Validate date range
  const validateDateRange = (from: string, to: string): string | null => {
    if (!from && !to) return null;
    if (from && to && new Date(from) > new Date(to)) {
      return 'Date From must be before or equal to Date To';
    }
    return null;
  };

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [depts, spon] = await Promise.all([
          api.getDepartments(),
          api.getSponsors(),
        ]);
        setDepartments(depts);
        setSponsors(spon);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);

  const fetchGrants = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (departmentFilter) {
        params.department = departmentFilter;
      }
      if (sponsorFilter) {
        params.sponsor = sponsorFilter;
      }
      // Only include dates if validation passes
      const dateValidationError = validateDateRange(dateFrom, dateTo);
      if (dateValidationError) {
        setDateError(dateValidationError);
        setLoading(false);
        return;
      }
      setDateError(null);

      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      const data = await api.getGrants(params);
      setGrants(data.items);
      setTotal(data.total);
    } catch (err) {
      let message = 'Failed to load grants';
      if (err instanceof NetworkError) {
        message = err.message;
      } else if (err instanceof ApiClientError) {
        message = err.message;
        // Show field-specific validation errors if available
        if (err.fields && Object.keys(err.fields).length > 0) {
          const fieldErrors = Object.entries(err.fields)
            .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
            .join('; ');
          message = `${message} (${fieldErrors})`;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [page, pageSize, debouncedSearch, statusFilter, departmentFilter, sponsorFilter, dateFrom, dateTo]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      const params: Record<string, string | number> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department = departmentFilter;
      if (sponsorFilter) params.sponsor = sponsorFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      params.format = format;

      const blob = await api.exportGrants(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grants-export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      let message = 'Export failed';
      if (err instanceof NetworkError) {
        message = err.message;
      } else if (err instanceof ApiClientError) {
        message = err.message;
      }
      alert(`Export error: ${message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = (grant: Grant) => {
    setSelectedGrant(grant);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedGrant(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  const totalPages = Math.ceil(total / pageSize);

  if (loading && grants.length === 0) {
    return (
      <div>
        <h1 style={{ marginBottom: '2rem', fontSize: '2rem', color: '#1a1a1a' }}>Grants</h1>
        <SkeletonTable rows={10} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', color: '#1a1a1a' }}>
        Grants
      </h1>

      {/* Filters */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          {/* Search */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // Reset to first page on search
              }}
              placeholder="Title or PI name..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Status Filter */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="awarded">Awarded</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Department
            </label>
            <select
              value={departmentFilter || ''}
              onChange={(e) => {
                setDepartmentFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
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

          {/* Sponsor Filter */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Sponsor
            </label>
            <select
              value={sponsorFilter || ''}
              onChange={(e) => {
                setSponsorFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              <option value="">All Sponsors</option>
              {sponsors.map((sponsor) => (
                <option key={sponsor.id} value={sponsor.id}>
                  {sponsor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                const newDateFrom = e.target.value;
                setDateFrom(newDateFrom);
                setPage(1);
                // Validate immediately on change
                const error = validateDateRange(newDateFrom, dateTo);
                setDateError(error);
              }}
              max={dateTo || undefined}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${dateError ? '#dc3545' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Date To */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#666',
                fontWeight: '500',
              }}
            >
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                const newDateTo = e.target.value;
                setDateTo(newDateTo);
                setPage(1);
                // Validate immediately on change
                const error = validateDateRange(dateFrom, newDateTo);
                setDateError(error);
              }}
              min={dateFrom || undefined}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${dateError ? '#dc3545' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        {/* Date Range Error Message */}
        {dateError && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              color: '#856404',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {dateError}
          </div>
        )}
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: exporting || loading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              opacity: exporting || loading ? 0.6 : 1,
            }}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting || loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: exporting || loading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              opacity: exporting || loading ? 0.6 : 1,
            }}
          >
            {exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay message={error} onRetry={fetchGrants} />}

      {/* Table */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Title
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  PI
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Department
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr
                  key={grant.id}
                  onClick={() => handleRowClick(grant)}
                  style={{
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9f9f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '1rem' }}>{grant.title}</td>
                  <td style={{ padding: '1rem' }}>{grant.pi?.name || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>{grant.department?.name || 'N/A'}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {formatCurrency(grant.amount)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        backgroundColor: getStatusColor(grant.status) + '20',
                        color: getStatusColor(grant.status),
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        textTransform: 'capitalize',
                      }}
                    >
                      {grant.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{formatDate(grant.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
            grants
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: page === 1 ? '#f5f5f5' : '#fff',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? '#999' : '#333',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: page === totalPages ? '#f5f5f5' : '#fff',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                color: page === totalPages ? '#999' : '#333',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <GrantDrawer
        grant={selectedGrant}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
