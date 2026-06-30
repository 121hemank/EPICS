import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { isAdmin, isManager } = useOrganization();
  const displayName = settings.displayName || user?.email?.split('@')[0] || 'User';
  const firstLetter = displayName.charAt(0).toUpperCase();

  const links = [
    { to: '/', label: 'Dashboard', show: true },
    { to: '/customers', label: 'Customers', show: true },
    { to: '/leads', label: 'Leads', show: true },
    { to: '/vendors', label: 'Vendors', show: true },
    { to: '/pipeline', label: 'Pipeline', show: true },
    { to: '/analytics', label: 'Analytics', show: true },
    { to: '/performance', label: 'Performance', show: true },
    { to: '/org-settings', label: 'Team', show: isAdmin },
    { to: '/settings', label: 'Settings', show: true },
  ];

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="profile-simple">
        <div className="profile-avatar-text">{firstLetter}</div>
        <h3 id="sidebarUserName">{displayName}</h3>
      </div>
      <ul>
        {links.filter(l => l.show).map(link => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
              style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
