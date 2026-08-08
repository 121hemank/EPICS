import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { loadActivityLogs, logActivity } from '../lib/supabase';
import { can, getPermissionDefs, ROLE_LABELS } from '../utils/helpers';
import { formatDateTime } from '../utils/helpers';
import { showToast } from '../utils/toast';
import Modal from '../components/shared/Modal';

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { currentOrg, role } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrg?.id;

  const [displayName, setDisplayName] = useState(settings.displayName || '');
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [theme, setTheme] = useState(settings.theme);

  const [sentimentWeight, setSentimentWeight] = useState(settings.sentimentWeight);
  const [ratingWeight, setRatingWeight] = useState(settings.ratingWeight);
  const [validationMsg, setValidationMsg] = useState('Sentiment weight + Rating weight must equal 100.');

  const [enableRules, setEnableRules] = useState(settings.enableRules);
  const [sentimentThreshold, setSentimentThreshold] = useState(settings.sentimentThreshold);
  const [ratingThreshold, setRatingThreshold] = useState(settings.ratingThreshold);
  const [scoreThreshold, setScoreThreshold] = useState(settings.scoreThreshold);
  const [rulesMsg, setRulesMsg] = useState('');

  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey || '');
  const [sendgridApiKey, setSendgridApiKey] = useState(settings.sendgridApiKey || '');
  const [sendgridFromEmail, setSendgridFromEmail] = useState(settings.sendgridFromEmail || '');
  const [whatsappWebhook, setWhatsappWebhook] = useState(settings.whatsappWebhook || '');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');

  const [auditLog, setAuditLog] = useState([]);

  const [connTesting, setConnTesting] = useState(false);
  const [connStatus, setConnStatus] = useState('idle');
  const [connMessage, setConnMessage] = useState('');

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setDisplayName(settings.displayName || '');
    setBackendUrl(settings.backendUrl);
    setTheme(settings.theme);
    setSentimentWeight(settings.sentimentWeight);
    setRatingWeight(settings.ratingWeight);
    setEnableRules(settings.enableRules);
    setSentimentThreshold(settings.sentimentThreshold);
    setRatingThreshold(settings.ratingThreshold);
    setScoreThreshold(settings.scoreThreshold);
    setOpenaiApiKey(settings.openaiApiKey || '');
    setSendgridApiKey(settings.sendgridApiKey || '');
    setWhatsappWebhook(settings.whatsappWebhook || '');
    setSupabaseUrl(settings.supabaseUrl || '');
  }, [settings]);

  const loadAudit = useCallback(async () => {
    if (!orgId) return;
    const data = await loadActivityLogs(orgId, 25);
    setAuditLog(data);
  }, [orgId]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const canDo = (perm) => can(role, perm);
  const actorName = settings.displayName || user?.email?.split('@')[0] || 'user';
  const audit = async (section, details) => {
    if (!orgId) return;
    try {
      await logActivity(orgId, 'update', 'settings', section, details);
      loadAudit();
    } catch { /* audit logging is best effort */ }
  };

  const handleAppSubmit = (e) => {
    e.preventDefault();
    updateSettings({ displayName, backendUrl, theme });
    audit('application', `${actorName} updated app settings (theme: ${theme})`);
    showToast('Application settings saved.', 'success');
  };

  const handleScoringSubmit = (e) => {
    e.preventDefault();
    const sw = Number(sentimentWeight);
    const rw = Number(ratingWeight);
    if (sw + rw !== 100) {
      setValidationMsg('Error: Sentiment weight + Rating weight must equal 100.');
      showToast('Weights must total 100.', 'error');
      return;
    }
    updateSettings({ sentimentWeight: sw, ratingWeight: rw });
    setValidationMsg('Scoring weights saved successfully.');
    audit('scoring', `${actorName} updated scoring weights to ${sw}/${rw}`);
    showToast('Scoring settings saved.', 'success');
  };

  const handleRulesSubmit = (e) => {
    e.preventDefault();
    updateSettings({
      enableRules,
      sentimentThreshold: Number(sentimentThreshold),
      ratingThreshold: Number(ratingThreshold),
      scoreThreshold: Number(scoreThreshold)
    });
    const msg = enableRules
      ? `Rules enabled (sentiment < ${sentimentThreshold}%, rating < ${ratingThreshold}, score < ${scoreThreshold})`
      : 'Scoring rules disabled';
    setRulesMsg(msg);
    audit('rules', `${actorName} updated scoring preset rules: ${msg}`);
    showToast('Scoring rules saved.', 'success');
  };

  const handleIntegrationsSubmit = (e) => {
    e.preventDefault();
    updateSettings({ openaiApiKey, sendgridApiKey, sendgridFromEmail, whatsappWebhook, supabaseUrl });
    audit('integrations', `${actorName} updated integration keys`);
    showToast('Integrations saved.', 'success');
  };

  const testConnection = async () => {
    setConnTesting(true);
    setConnStatus('idle');
    setConnMessage('');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${backendUrl.trim()}/`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConnStatus('ok');
      setConnMessage(data.message || 'Backend is reachable.');
      showToast('Backend connection successful.', 'success');
    } catch (err) {
      setConnStatus('fail');
      setConnMessage(err.name === 'AbortError'
        ? 'Request timed out after 8s.'
        : `Cannot reach backend: ${err.message}`);
      showToast('Backend connection failed.', 'error');
    } finally {
      setConnTesting(false);
    }
  };

  const togglePref = (key, value, label) => {
    updateSettings({ [key]: value });
    audit('notifications', `${actorName} ${value ? 'enabled' : 'disabled'} ${label}`);
    showToast(`${label} ${value ? 'enabled' : 'disabled'}.`, 'success');
  };

  const handleResetDefaults = () => {
    resetSettings();
    setConfirmReset(false);
    audit('settings', `${actorName} reset settings to defaults`);
    showToast('Settings reset to defaults.', 'success');
  };

  const handleClearStorage = () => {
    ['epics_crm_settings', 'epics_current_org_id', 'epics_notif_read'].forEach(k => localStorage.removeItem(k));
    setConfirmClear(false);
    showToast('Local storage cleared. Reloading...', 'info');
    setTimeout(() => window.location.reload(), 800);
  };

  const sw = Number(sentimentWeight);
  const rw = Number(ratingWeight);
  const weightsTotal = (Number.isFinite(sw) ? sw : 0) + (Number.isFinite(rw) ? rw : 0);
  const weightsValid = weightsTotal === 100;

  const permissionDefs = getPermissionDefs();
  const matrixRoles = Object.keys(ROLE_LABELS).filter(r => r !== 'employee');

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage CRM preferences, scoring rules, integrations, and access control.</p>
        </div>
        <div className="analysis-status" style={{ marginTop: 0 }}>
          Your role: <strong>{ROLE_LABELS[role] || role || '—'}</strong>
        </div>
      </div>

      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Application Preferences</h2>
          <form className="vendor-review-form" onSubmit={handleAppSubmit}>
            <div className="form-group">
              <label>Display Name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Backend URL {!canDo('settings.app') && <span className="perm-note">(admin only)</span>}</label>
              <div className="conn-input-row">
                <input type="text" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} placeholder="http://127.0.0.1:8000" disabled={!canDo('settings.app')} />
                <button type="button" className="analyze-btn conn-btn" onClick={testConnection} disabled={connTesting || !canDo('settings.app')}>
                  {connTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              {!canDo('settings.app') && <div className="field-error">You do not have permission to change the backend URL.</div>}
              {connStatus !== 'idle' && <div className={`conn-status conn-${connStatus}`}>{connMessage}</div>}
            </div>
            <div className="form-group">
              <label>Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <button type="submit" className="analyze-btn">Save App Settings</button>
          </form>
        </div>

        <div className="analytics-form-card">
          <h2>Scoring Weights</h2>
          <form className="vendor-review-form" onSubmit={handleScoringSubmit}>
            <div className="form-group">
              <label>AI Sentiment Weight (%) {!canDo('settings.weights') && <span className="perm-note">(manager+)</span>}</label>
              <input type="number" min="0" max="100" value={sentimentWeight} onChange={e => setSentimentWeight(e.target.value)} disabled={!canDo('settings.weights')} />
            </div>
            <div className="form-group">
              <label>Customer Rating Weight (%)</label>
              <input type="number" min="0" max="100" value={ratingWeight} onChange={e => setRatingWeight(e.target.value)} disabled={!canDo('settings.weights')} />
            </div>
            <div className={`analysis-status weight-status ${weightsValid ? 'weight-ok' : 'weight-warn'}`}>
              {weightsValid
                ? `Total: ${weightsTotal}% - Weights balanced.`
                : `Total: ${weightsTotal}% - AI Sentiment + Customer Rating must equal 100.`}
            </div>
            <button type="submit" className="analyze-btn" disabled={!canDo('settings.weights') || !weightsValid}>Save Scoring Settings</button>
          </form>
        </div>
      </div>

      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Scoring Preset Rules</h2>
          <form className="vendor-review-form" onSubmit={handleRulesSubmit}>
            <div className="form-group">
              <label>Automated Alert Rules {!canDo('settings.rules') && <span className="perm-note">(manager+)</span>}</label>
              <div className="toggle-row">
                <input type="checkbox" id="enableRules" checked={enableRules} onChange={e => setEnableRules(e.target.checked)} disabled={!canDo('settings.rules')} />
                <label htmlFor="enableRules" className="toggle-label">Enable threshold alerts</label>
              </div>
            </div>
            <div className="form-group">
              <label>Flag vendor if AI sentiment falls below (%)</label>
              <input type="number" min="0" max="100" value={sentimentThreshold} onChange={e => setSentimentThreshold(e.target.value)} disabled={!enableRules || !canDo('settings.rules')} />
            </div>
            <div className="form-group">
              <label>Trigger warning if customer rating drops below</label>
              <input type="number" min="1" max="5" step="0.1" value={ratingThreshold} onChange={e => setRatingThreshold(e.target.value)} disabled={!enableRules || !canDo('settings.rules')} />
            </div>
            <div className="form-group">
              <label>Flag vendor when overall score drops below</label>
              <input type="number" min="1" max="5" step="0.1" value={scoreThreshold} onChange={e => setScoreThreshold(e.target.value)} disabled={!enableRules || !canDo('settings.rules')} />
            </div>
            <div className="analysis-status">{rulesMsg || 'Rules power the notification center and inline analysis warnings.'}</div>
            <button type="submit" className="analyze-btn" disabled={!canDo('settings.rules')}>Save Rules</button>
          </form>
        </div>

        <div className="analytics-form-card">
          <h2>Integrations</h2>
          <form className="vendor-review-form" onSubmit={handleIntegrationsSubmit}>
            <div className="form-group">
              <label>OpenAI API Key {!canDo('settings.integrations') && <span className="perm-note">(admin only)</span>}</label>
              <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} placeholder="sk-..." autoComplete="off" disabled={!canDo('settings.integrations')} />
            </div>
            <div className="form-group">
              <label>SendGrid API Key</label>
              <input type="password" value={sendgridApiKey} onChange={e => setSendgridApiKey(e.target.value)} placeholder="SG.xxxx" autoComplete="off" disabled={!canDo('settings.integrations')} />
            </div>
            <div className="form-group">
              <label>SendGrid From Email</label>
              <input type="email" value={sendgridFromEmail} onChange={e => setSendgridFromEmail(e.target.value)} placeholder="your-verified-sender@example.com" autoComplete="off" disabled={!canDo('settings.integrations')} />
            </div>
            <div className="form-group">
              <label>WhatsApp Webhook URL</label>
              <input type="text" value={whatsappWebhook} onChange={e => setWhatsappWebhook(e.target.value)} placeholder="https://api.whatsapp.com/webhook" disabled={!canDo('settings.integrations')} />
            </div>
            <div className="form-group">
              <label>Supabase Project URL</label>
              <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" disabled={!canDo('settings.integrations')} />
            </div>
            <div className="analysis-status">Keys are stored locally in your browser and used by future automation modules.</div>
            <button type="submit" className="analyze-btn" disabled={!canDo('settings.integrations')}>Save Integrations</button>
          </form>
        </div>
      </div>

      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Notification Preferences</h2>
          <p className="batch-hint">Manage which alerts are sent. Toggles apply immediately.</p>
          <div className="pref-list">
            <div className="toggle-row pref-row">
              <input type="checkbox" id="prefEmailApproved" checked={!!settings.emailOnVendorApproved} onChange={e => togglePref('emailOnVendorApproved', e.target.checked, 'Approval emails')} />
              <label htmlFor="prefEmailApproved" className="toggle-label">Email vendors when they are approved</label>
            </div>
            <div className="toggle-row pref-row">
              <input type="checkbox" id="prefEmailLowScore" checked={!!settings.emailLowScoreAlerts} onChange={e => togglePref('emailLowScoreAlerts', e.target.checked, 'Low score alerts')} />
              <label htmlFor="prefEmailLowScore" className="toggle-label">Email alerts for low vendor scores</label>
            </div>
            <div className="toggle-row pref-row">
              <input type="checkbox" id="prefBrowserLeads" checked={!!settings.browserNewLeadAlerts} onChange={e => togglePref('browserNewLeadAlerts', e.target.checked, 'New lead notifications')} />
              <label htmlFor="prefBrowserLeads" className="toggle-label">Real-time browser notifications for new leads</label>
            </div>
          </div>
        </div>
        <div className="analytics-form-card">
          <h2>About</h2>
          <p className="batch-hint">Your notification preferences are stored locally in your browser and used by the topbar notification center and email automation.</p>
          <div className="analysis-status">
            Approval emails use the SendGrid API key configured in Integrations.
          </div>
        </div>
      </div>

      <div className="vendor-table-card danger-zone">
        <div className="table-header"><h3>Danger Zone</h3></div>
        <p className="batch-hint">Reset the app to a clean state. These actions cannot be undone.</p>
        <div className="danger-actions">
          <button type="button" className="action-btn" onClick={() => setConfirmReset(true)}>Reset to Default Settings</button>
          <button type="button" className="action-btn delete-btn" onClick={() => setConfirmClear(true)}>Clear Local Storage</button>
        </div>
      </div>

      <div className="vendor-table-card">
        <div className="table-header"><h3>Permissions Matrix</h3></div>
        <div className="table-wrapper">
          <table className="vendor-score-table">
            <thead>
              <tr>
                <th>Permission</th>
                {matrixRoles.map(r => <th key={r}>{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {permissionDefs.map(p => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  {matrixRoles.map(r => (
                    <td key={r}>
                      <span className={`perm-dot ${p.roles.includes(r) ? 'perm-yes' : 'perm-no'}`} aria-label={p.roles.includes(r) ? 'Allowed' : 'Not allowed'}>
                        {p.roles.includes(r) ? '✓' : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="vendor-table-card">
        <div className="table-header"><h3>Audit Trail</h3></div>
        <div className="table-wrapper">
          <table className="vendor-score-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {auditLog.length === 0 ? <tr><td colSpan="4">No activity recorded yet.</td></tr> :
                auditLog.map((a, i) => (
                  <tr key={i}>
                    <td>{formatDateTime(a.created_at)}</td>
                    <td>{a.user?.email || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.action} {a.entity_type}</td>
                    <td>{a.details}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to Default Settings">
        <p className="danger-modal-text">This will restore all settings (weights, rules, integrations, preferences) to their defaults. Continue?</p>
        <div className="modal-actions">
          <button type="button" className="action-btn delete-btn" onClick={handleResetDefaults}>Yes, Reset</button>
          <button type="button" className="action-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear Local Storage">
        <p className="danger-modal-text">This clears cached settings, your selected organization, and read notifications from this browser. You will need to sign in again. Continue?</p>
        <div className="modal-actions">
          <button type="button" className="action-btn delete-btn" onClick={handleClearStorage}>Yes, Clear</button>
          <button type="button" className="action-btn" onClick={() => setConfirmClear(false)}>Cancel</button>
        </div>
      </Modal>
    </>
  );
}
