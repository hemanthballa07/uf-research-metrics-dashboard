import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { GrantsPage } from './pages/GrantsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { Layout } from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/grants" element={<GrantsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

