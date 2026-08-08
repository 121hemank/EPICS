import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { loadActivityLogs, logActivity } from '../lib/supabase';
import { can, getPermissionDefs, ROLE_LABELS } from '../utils/helpers';
import { formatDateTime } from '../utils/helpers';
import { showToast } from '../utils/toast';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
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
  const [whatsappWebhook, setWhatsappWebhook] = useState(settings.whatsappWebhook || '');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');

  const [auditLog, setAuditLog] = useState([]);

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
    updateSettings({ openaiApiKey, sendgridApiKey, whatsappWebhook, supabaseUrl });
    audit('integrations', `${actorName} updated integration keys`);
    showToast('Integrations saved.', 'success');
  };

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
              <input type="text" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} placeholder="http://127.0.0.1:8000" disabled={!canDo('settings.app')} />
              {!canDo('settings.app') && <div className="field-error">You do not have permission to change the backend URL.</div>}
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
            <div className="analysis-status">{validationMsg}</div>
            <button type="submit" className="analyze-btn" disabled={!canDo('settings.weights')}>Save Scoring Settings</button>
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
    </>
  );
}
