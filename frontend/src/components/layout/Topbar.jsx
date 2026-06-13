import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { logout } from '../../lib/supabase';
import { showToast } from '../../utils/toast';

export default function Topbar() {
  const [clock, setClock] = useState(new Date().toLocaleString());
  const { user } = useAuth();
  const { settings } = useSettings();
  const displayName = settings.displayName || user?.email?.split('@')[0] || 'User';
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      showToast('Logout failed', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="menu-toggle" onClick={() => {}}>☰</span>
        <h2 className="topbar-title">VendorCRM</h2>
      </div>
      <div className="topbar-right">
        <span id="liveClock">{clock}</span>
        <span className="topbar-user">{displayName}</span>
        <button className="topbar-logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
