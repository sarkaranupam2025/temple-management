import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import TemplesPage from './pages/TemplesPage';
import BookingsPage from './pages/BookingsPage';
import DonationsPage from './pages/DonationsPage';
import PrasadPage from './pages/PrasadPage';
import VolunteersPage from './pages/VolunteersPage';
import CommunicationPage from './pages/CommunicationPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={auth.login} />} />
        <Route path="/register" element={<RegisterPage onLogin={auth.login} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Layout user={auth.user!} onLogout={auth.logout} isAdmin={!!auth.isAdmin}>
      <Routes>
        <Route path="/" element={<Dashboard token={auth.token!} isAdmin={!!auth.isAdmin} />} />
        <Route path="/temples" element={<TemplesPage token={auth.token!} isAdmin={!!auth.isAdmin} />} />
        <Route path="/bookings" element={<BookingsPage token={auth.token!} />} />
        <Route path="/donations" element={<DonationsPage token={auth.token!} />} />
        <Route path="/prasad" element={<PrasadPage token={auth.token!} />} />
        <Route path="/volunteers" element={<VolunteersPage token={auth.token!} />} />
        <Route path="/communication" element={<CommunicationPage token={auth.token!} />} />
        {auth.isAdmin && <Route path="/analytics" element={<AnalyticsPage token={auth.token!} />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
