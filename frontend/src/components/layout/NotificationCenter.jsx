import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { loadLeads, loadVendorScores, loadActivityLogs } from '../../lib/supabase';
import { formatDateTime } from '../../utils/helpers';

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const TYPE_BADGE = { lead: 'Lead', score: 'Score', ai: 'AI' };
const OPEN_STATUSES = ['open', 'contacted', 'follow-up'];

export default function NotificationCenter() {
  const { currentOrg, isManager } = useOrganization();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readKeys, setReadKeys] = useState([]);
  const wrapRef = useRef(null);
  const orgId = currentOrg?.id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('epics_notif_read');
      setReadKeys(raw ? JSON.parse(raw) : []);
    } catch {
      setReadKeys([]);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!orgId) return;
    const [leads, scores, logs] = await Promise.all([
      loadLeads(orgId),
      loadVendorScores(orgId),
      loadActivityLogs(orgId, 50)
    ]);
    const items = [];

    leads
      .filter(l => (l.priority || '').toLowerCase() === 'high' && OPEN_STATUSES.includes((l.status || '').toLowerCase()))
      .forEach(l => items.push({
        id: `lead:${l.id}`,
        type: 'lead',
        title: `High-priority lead: ${l.vendor_name}`,
        detail: l.contact_person ? `Contact: ${l.contact_person}` : 'Awaiting follow-up',
        time: l.created_at
      }));

    const scoreThreshold = Number(settings.scoreThreshold ?? 3);
    scores
      .filter(s => Number(s.vendor_score || 0) < scoreThreshold)
      .forEach(s => items.push({
        id: `score:${s.vendor_name}`,
        type: 'score',
        title: `Vendor score dropped: ${s.vendor_name}`,
        detail: `Current score: ${Number(s.vendor_score).toFixed(2)} (below ${scoreThreshold})`,
        time: s.updated_at
      }));

    logs
      .filter(a => a.action === 'analyze' && (a.details || '').toLowerCase().includes('failed'))
      .forEach(a => items.push({
        id: `ai:${a.id}`,
        type: 'ai',
        title: `Failed AI analysis: ${a.entity_name || 'review'}`,
        detail: a.details,
        time: a.created_at
      }));

    setNotifications(items);
  }, [orgId, settings.scoreThreshold]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = notifications.filter(n => !readKeys.includes(n.id)).length;

  const markAllRead = () => {
    const keys = [...new Set([...readKeys, ...notifications.map(n => n.id)])];
    setReadKeys(keys);
    localStorage.setItem('epics_notif_read', JSON.stringify(keys));
  };

  if (!isManager) return null;

  return (
    <div className="notification-wrap" ref={wrapRef}>
      <button
        className="notification-btn"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-drawer" role="dialog" aria-label="Notifications">
          <div className="notification-header">
            <h3>Notifications</h3>
            <button type="button" className="link-btn" onClick={markAllRead} disabled={!notifications.length}>
              Mark all read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="notification-empty">You're all caught up.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map(n => (
                <li key={n.id} className={`notification-item notif-${n.type}${readKeys.includes(n.id) ? ' read' : ''}`}>
                  <span className="notif-type">{TYPE_BADGE[n.type]}</span>
                  <div className="notif-body">
                    <strong>{n.title}</strong>
                    <p>{n.detail}</p>
                    <small>{formatDateTime(n.time)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
