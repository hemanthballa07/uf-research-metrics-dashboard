import { useState, useEffect } from 'react';
import { api, ApiClientError, NetworkError } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';

interface LeaderboardEntry {
  facultyId: number;
  facultyName: string;
  departmentName: string;
  totalAwarded: number;
  rank: number;
}

export function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | undefined>(undefined);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getFacultyLeaderboard(
          selectedDepartment ? { department: selectedDepartment } : undefined
        );
        setLeaderboard(data);

        // Extract unique departments from leaderboard data for dropdown
        // Note: This is a simplified approach - in production, you'd fetch departments from a dedicated endpoint
        if (data.length > 0) {
          const uniqueDepts = new Map<string, number>();
          data.forEach((entry) => {
            if (!uniqueDepts.has(entry.departmentName)) {
              // Use a hash of the name as a temporary ID
              // In production, this would come from a departments API
              uniqueDepts.set(entry.departmentName, entry.departmentName.length);
            }
          });
          setDepartments(
            Array.from(uniqueDepts.entries())
              .map(([name, id]) => ({ id, name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      } catch (err) {
        let message = 'Failed to load leaderboard';
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

    fetchLeaderboard();
  }, [selectedDepartment]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return '#ffd700'; // Gold
    if (rank === 2) return '#c0c0c0'; // Silver
    if (rank === 3) return '#cd7f32'; // Bronze
    return '#4a9eff'; // Blue
  };

  if (loading && leaderboard.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', color: '#1a1a1a' }}>
        Faculty Leaderboard
      </h1>

      {/* Department Filter */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
            color: '#666',
            fontWeight: '500',
          }}
        >
          Filter by Department
        </label>
        <select
          value={selectedDepartment || ''}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedDepartment(value ? parseInt(value, 10) : undefined);
          }}
          style={{
            width: '100%',
            maxWidth: '300px',
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

      {error && <ErrorDisplay message={error} onRetry={() => window.location.reload()} />}

      {/* Leaderboard Table */}
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
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#666',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    width: '80px',
                  }}
                >
                  Rank
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
                  Faculty Name
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
                  Total Awarded
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: '#999',
                    }}
                  >
                    No faculty found
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry) => (
                  <tr
                    key={entry.facultyId}
                    style={{
                      borderBottom: '1px solid #eee',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9f9f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: getRankBadgeColor(entry.rank) + '20',
                          color: getRankBadgeColor(entry.rank),
                          fontWeight: 'bold',
                          fontSize: '1rem',
                        }}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '500', color: '#1a1a1a' }}>
                      {entry.facultyName}
                    </td>
                    <td style={{ padding: '1rem', color: '#666' }}>
                      {entry.departmentName}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#1a1a1a',
                      }}
                    >
                      {formatCurrency(entry.totalAwarded)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {leaderboard.length > 0 && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#666',
          }}
        >
          Showing {leaderboard.length} faculty member{leaderboard.length !== 1 ? 's' : ''} ranked
          by total awarded amount in the last 12 months
          {selectedDepartment && departments.find((d) => d.id === selectedDepartment) && (
            <span>
              {' '}
              in{' '}
              <strong>
                {departments.find((d) => d.id === selectedDepartment)?.name}
              </strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
