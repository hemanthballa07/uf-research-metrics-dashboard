import { useState, useEffect } from 'react';
import { api, ApiClientError, NetworkError } from '../lib/apiClient.js';
import { toast } from '../lib/toast.js';
import { SkeletonTable } from '../components/Skeleton.js';

type User = {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 8,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  marginBottom: 24,
};

const thStyle: React.CSSProperties = {
  padding: '1rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#666',
  fontSize: '0.9rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tdStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '0.9rem',
  color: '#333',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#555',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('VIEWER');
  const [creating, setCreating] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwSectionOpen, setPwSectionOpen] = useState(false);

  const fetchUsers = async (targetPage = page) => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await api.listUsers({ page: targetPage, pageSize });
      setUsers(data.items);
      setTotalUsers(data.total);
      setTotalPages(data.totalPages);
      setPage(targetPage);
    } catch (err) {
      let msg = 'Failed to load users';
      if (err instanceof NetworkError || err instanceof ApiClientError) msg = err.message;
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleRole = async (user: User) => {
    const newRole = user.role === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    try {
      await api.updateUserRole(user.id, newRole);
      toast.success(`${user.name} is now ${newRole}`);
      fetchUsers(page);
    } catch (err) {
      let msg = 'Failed to update role';
      if (err instanceof NetworkError || err instanceof ApiClientError) msg = err.message;
      toast.error(msg);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    try {
      await api.deleteUser(user.id);
      toast.success(`User ${user.name} deleted`);
      // Go back to page 1 if we deleted the last item on this page
      const newPage = users.length === 1 && page > 1 ? page - 1 : page;
      fetchUsers(newPage);
    } catch (err) {
      let msg = 'Failed to delete user';
      if (err instanceof NetworkError || err instanceof ApiClientError) msg = err.message;
      toast.error(msg);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      setCreating(true);
      await api.createUser({ email: createEmail, name: createName, password: createPassword, role: createRole });
      toast.success(`User ${createName} created`);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('VIEWER');
      fetchUsers();
    } catch (err) {
      let msg = 'Failed to create user';
      if (err instanceof NetworkError || err instanceof ApiClientError) msg = err.message;
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      setChangingPw(true);
      await api.changePassword(pwCurrent, pwNew);
      toast.success('Password changed');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      let msg = 'Failed to change password';
      if (err instanceof NetworkError || err instanceof ApiClientError) msg = err.message;
      toast.error(msg);
    } finally {
      setChangingPw(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem', color: '#1a1a1a' }}>User Management</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        ADMIN-only page. Non-admin users will receive 403 errors on mutations.
      </p>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.25rem', color: '#1a1a1a' }}>Users</h2>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : fetchError ? (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 4,
              color: '#856404',
              fontSize: '0.9rem',
            }}
          >
            {fetchError}
            <button
              onClick={() => fetchUsers()}
              style={{
                marginLeft: 12,
                padding: '0.25rem 0.75rem',
                backgroundColor: '#ffc107',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{user.name}</td>
                      <td style={tdStyle}>{user.email}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.65rem',
                            borderRadius: 4,
                            backgroundColor: user.role === 'ADMIN' ? '#4a9eff22' : '#99999922',
                            color: user.role === 'ADMIN' ? '#4a9eff' : '#999',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleRole(user)}
                          style={{
                            marginRight: 8,
                            padding: '0.3rem 0.75rem',
                            backgroundColor: user.role === 'ADMIN' ? '#6c757d' : '#4a9eff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                          }}
                        >
                          {user.role === 'ADMIN' ? 'Make VIEWER' : 'Make ADMIN'}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: '0.875rem', color: '#666' }}>
            <span>{totalUsers} users total</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fetchUsers(page - 1)}
                disabled={page <= 1}
                style={{ padding: '0.3rem 0.75rem', border: '1px solid #ddd', borderRadius: 4, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#fff' }}
              >
                Prev
              </button>
              <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
              <button
                onClick={() => fetchUsers(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: '0.3rem 0.75rem', border: '1px solid #ddd', borderRadius: 4, cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: '#fff' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.25rem', color: '#1a1a1a' }}>Create New User</h2>
        <form onSubmit={handleCreateSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Full name"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="user@example.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Min 8 characters"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value)}
                style={inputStyle}
              >
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: creating ? '#aaa' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      <div style={cardStyle}>
        <button
          onClick={() => setPwSectionOpen((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: pwSectionOpen ? 16 : 0,
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{pwSectionOpen ? '▲' : '▼'}</span>
          Change Own Password
        </button>

        {pwSectionOpen && (
          <form onSubmit={handleChangePassword}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <label style={labelStyle}>Current Password</label>
                <input
                  type="password"
                  required
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  placeholder="Current password"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="Min 8 characters"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  style={inputStyle}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={changingPw}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: changingPw ? '#aaa' : '#4a9eff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: changingPw ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {changingPw ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
