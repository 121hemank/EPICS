import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { logout } from '../../lib/supabase';
import { showToast } from '../../utils/toast';
import GlobalSearch from './GlobalSearch';
import NotificationCenter from './NotificationCenter';

export default function Topbar() {
  const [clock, setClock] = useState(new Date().toLocaleString());
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { currentOrg, organizations, role, switchOrg } = useOrganization();
  const displayName = settings.displayName || user?.email?.split('@')[0] || 'User';
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      showToast('Logout failed', 'error');
    }
  };

  const roleBadge = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  const firstLetter = displayName.charAt(0).toUpperCase();
  const isDark = settings.theme === 'dark';

  const toggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="menu-toggle" onClick={() => {}} aria-label="Toggle menu">☰</span>
        <h2 className="topbar-title">VendorCRM</h2>
      </div>
      <div className="topbar-right">
        <div className="org-switcher" ref={dropdownRef}>
          <button
            className="org-switcher-btn"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            aria-expanded={orgDropdownOpen}
            aria-haspopup="listbox"
          >
            <span className="org-switcher-name">{currentOrg?.name || 'No Org'}</span>
            <span className="org-switcher-arrow">▾</span>
          </button>
          {orgDropdownOpen && (
            <div className="org-dropdown" role="listbox">
              {organizations.map(org => (
                <button
                  key={org.id}
                  role="option"
                  aria-selected={org.id === currentOrg?.id}
                  className={`org-dropdown-item ${org.id === currentOrg?.id ? 'active' : ''}`}
                  onClick={() => {
                    switchOrg(org.id);
                    setOrgDropdownOpen(false);
                  }}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
        <GlobalSearch />
        <NotificationCenter />
        <span id="liveClock" title={clock}>{clock}</span>
        <span className="topbar-user" title={displayName}>
          <span className="topbar-user-avatar" aria-hidden="true">{firstLetter}</span>
          {displayName}
        </span>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
        </button>
        <button className="topbar-logout-btn" onClick={handleLogout} aria-label="Logout">Logout</button>
      </div>
    </header>
  );
}
