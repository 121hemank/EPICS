import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { loadVendors, saveVendorReview, upsertVendorScore, upsertCustomer } from '../lib/supabase';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import { analyzeReviewWithBackend } from '../lib/api';
import { sentimentToScore, scoreToSentiment } from '../utils/helpers';
import { showToast } from '../utils/toast';
import { useSettings } from '../context/SettingsContext';

export default function Analytics() {
  const { currentOrg } = useOrganization();
  const { settings } = useSettings();
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ customerName: '', vendorName: '', rating: '', reviewText: '' });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('No analysis yet.');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const v = await loadVendors(orgId);
      setVendors(v);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const validate = () => {
    const e = {};
    if (!form.customerName.trim()) e.customerName = 'Customer name is required.';
    if (!form.vendorName) e.vendorName = 'Vendor name is required.';
    if (!form.rating) e.rating = 'Please select a rating.';
    if (!form.reviewText.trim()) e.reviewText = 'Review text is required.';
    else if (form.reviewText.trim().length < 8) e.reviewText = 'Review should be at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { showToast('Please fix the highlighted fields.', 'error'); return; }

    const approved = vendors.some(v => v.vendor_name === form.vendorName);
    if (!approved) { showToast('Selected vendor is not approved.', 'error'); return; }

    setAnalyzing(true);
    setResult(null);
    setStatus('Running AI analysis and updating vendor score...');
    try {
      const backendResult = await analyzeReviewWithBackend(form.reviewText);
      const bertweetPred = backendResult?.bertweet?.prediction || 'Neutral';
      const bertweetConf = backendResult?.bertweet?.confidence || 0;
      const robertaPred = backendResult?.roberta?.prediction || 'Neutral';
      const robertaConf = backendResult?.roberta?.confidence || 0;

      const bertweetScore = sentimentToScore(bertweetPred);
      const robertaScore = sentimentToScore(robertaPred);
      const modelAvg = (bertweetScore + robertaScore) / 2;
      const sentimentW = Number(settings.sentimentWeight || 50);
      const ratingW = Number(settings.ratingWeight || 50);
      const finalScore = ((modelAvg * sentimentW) + (Number(form.rating) * ratingW)) / 100;
      const finalSentiment = scoreToSentiment(finalScore);

      await saveVendorReview({
        customer_name: form.customerName.trim(),
        vendor_name: form.vendorName,
        organization_id: orgId,
        rating: Number(form.rating),
        customer_review: form.reviewText.trim(),
        bertweet_prediction: bertweetPred,
        bertweet_confidence: bertweetConf,
        roberta_prediction: robertaPred,
        roberta_confidence: robertaConf,
        final_sentiment: finalSentiment,
        final_score: finalScore
      });
      await upsertVendorScore(form.vendorName, form.rating, finalSentiment, finalScore, orgId);
      await upsertCustomer(form.customerName.trim(), form.vendorName, form.rating, form.reviewText.trim(), orgId);

      setResult({ bertweetPred, bertweetConf, robertaPred, robertaConf, finalSentiment, finalScore });
      setStatus('Review analyzed and vendor score updated successfully.');
      setForm({ customerName: '', vendorName: '', rating: '', reviewText: '' });
      setErrors({});
      showToast('Review submitted and vendor score updated.', 'success');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      showToast('Analysis failed. Please try again.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (loading) return <LoadingSkeleton type="card" count={3} />;
  if (error) return <div className="error-state"><p>Failed to load vendors: {error}</p><button onClick={() => window.location.reload()}>Try Again</button></div>;
  if (vendors.length === 0) return <div className="empty-state"><h3>No Approved Vendors</h3><p>You need at least one approved vendor before submitting reviews. Add a vendor from the Vendors page.</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Vendor Review Analysis</h1>
          <p>Analyze customer reviews and automatically update vendor scores.</p>
        </div>
      </div>
      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Submit Review</h2>
          <form className="vendor-review-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" placeholder="Enter customer name" value={form.customerName} onChange={set('customerName')} className={errors.customerName ? 'input-error' : ''} />
              {errors.customerName && <div className="field-error">{errors.customerName}</div>}
            </div>
            <div className="form-group">
              <label>Vendor Name</label>
              <select value={form.vendorName} onChange={set('vendorName')} className={errors.vendorName ? 'input-error' : ''}>
                <option value="">Select approved vendor</option>
                {vendors.map(v => <option key={v.vendor_name} value={v.vendor_name}>{v.vendor_name}</option>)}
              </select>
              {errors.vendorName && <div className="field-error">{errors.vendorName}</div>}
            </div>
            <div className="form-group">
              <label>Rating (1 to 5)</label>
              <select value={form.rating} onChange={set('rating')} className={errors.rating ? 'input-error' : ''}>
                <option value="">Select rating</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} - {['Very Poor','Poor','Average','Good','Excellent'][n-1]}</option>)}
              </select>
              {errors.rating && <div className="field-error">{errors.rating}</div>}
            </div>
            <div className="form-group">
              <label>Customer Review</label>
              <textarea rows="6" placeholder="Write the customer review here." value={form.reviewText} onChange={set('reviewText')} className={errors.reviewText ? 'input-error' : ''} />
              {errors.reviewText && <div className="field-error">{errors.reviewText}</div>}
            </div>
            <button type="submit" className="analyze-btn" disabled={analyzing}>
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </button>
          </form>
        </div>
        <div className="analytics-result-card">
          <h2>Analysis Result</h2>
          <div className="analysis-status">{status}</div>
          {result && (
            <div className="analysis-result-box">
              <div className="result-row"><span>BERTweet Prediction</span><strong>{result.bertweetPred}</strong></div>
              <div className="result-row"><span>BERTweet Confidence</span><strong>{Number(result.bertweetConf).toFixed(4)}</strong></div>
              <div className="result-row"><span>RoBERTa Prediction</span><strong>{result.robertaPred}</strong></div>
              <div className="result-row"><span>RoBERTa Confidence</span><strong>{Number(result.robertaConf).toFixed(4)}</strong></div>
              <hr />
              <div className="result-row"><span>Final Sentiment</span><strong>{result.finalSentiment}</strong></div>
              <div className="result-row"><span>Final Vendor Score</span><strong>{Number(result.finalScore).toFixed(2)}</strong></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
