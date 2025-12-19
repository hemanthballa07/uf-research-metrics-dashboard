import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: '#1a1a1a',
          color: '#fff',
          padding: '1rem 2rem',
          borderBottom: '1px solid #333',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>UF Research Metrics Platform</h1>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <Link
              to="/dashboard"
              style={{
                color: isActive('/dashboard') ? '#4a9eff' : '#ccc',
                textDecoration: 'none',
                fontWeight: isActive('/dashboard') ? '600' : '400',
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/grants"
              style={{
                color: isActive('/grants') ? '#4a9eff' : '#ccc',
                textDecoration: 'none',
                fontWeight: isActive('/grants') ? '600' : '400',
              }}
            >
              Grants
            </Link>
            <Link
              to="/leaderboard"
              style={{
                color: isActive('/leaderboard') ? '#4a9eff' : '#ccc',
                textDecoration: 'none',
                fontWeight: isActive('/leaderboard') ? '600' : '400',
              }}
            >
              Leaderboard
            </Link>
          </nav>
        </div>
      </header>
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
      <footer
        style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem 2rem',
          textAlign: 'center',
          color: '#666',
          borderTop: '1px solid #ddd',
        }}
      >
        <p style={{ margin: 0 }}>© 2024 University of Florida - Office of Research</p>
      </footer>
    </div>
  );
}

