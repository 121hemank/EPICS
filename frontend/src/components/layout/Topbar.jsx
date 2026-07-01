import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { logout } from '../../lib/supabase';
import { showToast } from '../../utils/toast';

export default function Topbar() {
  const [clock, setClock] = useState(new Date().toLocaleString());
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
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

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="menu-toggle" onClick={() => {}}>☰</span>
        <h2 className="topbar-title">VendorCRM</h2>
      </div>
      <div className="topbar-right">
        <div className="org-switcher" ref={dropdownRef}>
          <button
            className="org-switcher-btn"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
          >
            <span className="org-switcher-name">{currentOrg?.name || 'No Org'}</span>
            <span className="org-switcher-arrow">▾</span>
          </button>
          {orgDropdownOpen && (
            <div className="org-dropdown">
              {organizations.map(org => (
                <button
                  key={org.id}
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
        <span id="liveClock">{clock}</span>
        <span className="topbar-user">{displayName}</span>
        <button className="topbar-logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
