import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { showToast } from '../utils/toast';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [theme, setTheme] = useState(settings.theme);
  const [sentimentWeight, setSentimentWeight] = useState(settings.sentimentWeight);
  const [ratingWeight, setRatingWeight] = useState(settings.ratingWeight);
  const [validationMsg, setValidationMsg] = useState('Sentiment weight + Rating weight must equal 100.');

  useEffect(() => {
    setBackendUrl(settings.backendUrl);
    setTheme(settings.theme);
    setSentimentWeight(settings.sentimentWeight);
    setRatingWeight(settings.ratingWeight);
  }, [settings]);

  const handleAppSubmit = (e) => {
    e.preventDefault();
    updateSettings({ backendUrl, theme });
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
    showToast('Scoring settings saved.', 'success');
  };

  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Manage CRM preferences and scoring configuration.</p></div></div>
      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Application Preferences</h2>
          <form className="vendor-review-form" onSubmit={handleAppSubmit}>
            <div className="form-group">
              <label>Backend URL</label>
              <input type="text" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} placeholder="http://127.0.0.1:8000" />
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
              <label>AI Sentiment Weight (%)</label>
              <input type="number" min="0" max="100" value={sentimentWeight} onChange={e => setSentimentWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Customer Rating Weight (%)</label>
              <input type="number" min="0" max="100" value={ratingWeight} onChange={e => setRatingWeight(e.target.value)} />
            </div>
            <div className="analysis-status">{validationMsg}</div>
            <button type="submit" className="analyze-btn">Save Scoring Settings</button>
          </form>
        </div>
      </div>
    </>
  );
}
