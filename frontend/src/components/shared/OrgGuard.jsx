import { Navigate, Outlet } from 'react-router-dom';
import { useOrganization } from '../../context/OrganizationContext';

export default function OrgGuard() {
  const { currentOrg, organizations, loading } = useOrganization();

  if (loading) return <div className="auth-loading" />;

  if (organizations.length === 0) {
    return <Navigate to="/org-setup" replace />;
  }

  if (!currentOrg) {
    return <Navigate to="/org-setup" replace />;
  }

  return <Outlet />;
}
