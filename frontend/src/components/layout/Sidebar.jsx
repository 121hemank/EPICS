import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/customers', label: 'Customers' },
  { to: '/leads', label: 'Leads' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/performance', label: 'Performance' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const displayName = settings.displayName || user?.email?.split('@')[0] || 'User';
  const firstLetter = displayName.charAt(0).toUpperCase();

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="profile-simple">
        <div className="profile-avatar-text">{firstLetter}</div>
        <h3 id="sidebarUserName">{displayName}</h3>
      </div>
      <ul>
        {links.map(link => (
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
