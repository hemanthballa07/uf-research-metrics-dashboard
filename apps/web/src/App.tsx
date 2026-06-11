import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { GrantsPage } from './pages/GrantsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { InsightsPage } from './pages/InsightsPage';
import { IngestPage } from './pages/IngestPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { ExpiryPage } from './pages/ExpiryPage';
import { AskPage } from './pages/AskPage';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/dashboard" replace />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grants"
        element={
          <ProtectedRoute>
            <Layout>
              <GrantsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Layout>
              <LeaderboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <Layout>
              <InsightsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ingest"
        element={
          <ProtectedRoute>
            <Layout>
              <IngestPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminUsersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grants/expiring"
        element={
          <ProtectedRoute>
            <Layout>
              <ExpiryPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ask"
        element={
          <ProtectedRoute>
            <Layout>
              <AskPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
