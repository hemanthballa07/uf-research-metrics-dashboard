import { useState, useEffect, useMemo } from 'react';
import { api, ApiClientError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { GrantDrawer } from '../components/GrantDrawer';
import { useDebounce } from '../hooks/useDebounce';

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

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const debouncedSearch = useDebounce(search, 500);

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
      const message =
        err instanceof ApiClientError ? err.message : 'Failed to load grants';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [page, pageSize, debouncedSearch, statusFilter, dateFrom, dateTo]);

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
    return <LoadingSpinner />;
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
                setDateFrom(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
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
                setDateTo(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
          </div>
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
