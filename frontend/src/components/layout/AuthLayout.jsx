import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading" />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
