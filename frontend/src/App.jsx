import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import OrgGuard from './components/shared/OrgGuard';
import AuthLayout from './components/layout/AuthLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import ToastContainer from './components/shared/ToastContainer';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OrgSetup from './pages/OrgSetup';
import OrgSettings from './pages/OrgSettings';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Analytics from './pages/Analytics';
import Leads from './pages/Leads';
import Vendors from './pages/Vendors';
import Pipeline from './pages/Pipeline';
import Performance from './pages/Performance';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
              <Route path="/signup" element={<ErrorBoundary><Signup /></ErrorBoundary>} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/org-setup" element={<ErrorBoundary><OrgSetup /></ErrorBoundary>} />
              <Route element={<OrganizationProvider />}>
                <Route element={<OrgGuard />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                    <Route path="/customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
                    <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
                    <Route path="/leads" element={<ErrorBoundary><Leads /></ErrorBoundary>} />
                    <Route path="/vendors" element={<ErrorBoundary><Vendors /></ErrorBoundary>} />
                    <Route path="/pipeline" element={<ErrorBoundary><Pipeline /></ErrorBoundary>} />
                    <Route path="/performance" element={<ErrorBoundary><Performance /></ErrorBoundary>} />
                    <Route path="/org-settings" element={<ErrorBoundary><OrgSettings /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
