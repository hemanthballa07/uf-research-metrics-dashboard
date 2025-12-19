import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { GrantsPage } from './pages/GrantsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { InsightsPage } from './pages/InsightsPage';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/grants" element={<GrantsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

