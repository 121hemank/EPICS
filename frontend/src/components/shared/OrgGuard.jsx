import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';

export default function OrgGuard() {
  const { loading: authLoading } = useAuth();
  const { currentOrg, organizations, loading: orgLoading } = useOrganization();

  if (authLoading || orgLoading) return <div className="auth-loading" />;

  if (organizations.length === 0 || !currentOrg) {
    return <Navigate to="/org-setup" replace />;
  }

  return <Outlet />;
}
