import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import {
  loadVendors, saveVendorReview, upsertVendorScore, upsertCustomer,
  loadVendorScoreByName, loadAllVendorReviews, logActivity
} from '../lib/supabase';
import { analyzeReviewWithBackend, analyzeReviewsBatch } from '../lib/api';
import {
  sentimentToScore, scoreToSentiment, parseCSV, extractTopics, suggestAction, analyzeAspects, formatDateTime
} from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import { showToast } from '../utils/toast';
import { useSettings } from '../context/SettingsContext';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function themeColor(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function buildTrend(reviews) {
  const sorted = [...reviews].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const buckets = {};
  sorted.forEach(r => {
    const d = new Date(r.created_at);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(Number(r.final_score || 0));
  });
  return {
    labels: Object.keys(buckets).map(k => {
      const [y, m] = k.split('-');
      return `${MONTHS[Number(m) - 1]} ${y}`;
    }),
    data: Object.values(buckets).map(arr => Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)))
  };
}

export default function Analytics() {
  const { currentOrg } = useOrganization();
  const { settings } = useSettings();
  const [vendors, setVendors] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ customerName: '', vendorName: '', rating: '', reviewText: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('No analysis yet.');
  const [errors, setErrors] = useState({});

  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [batchSummary, setBatchSummary] = useState(null);
  const [csvError, setCsvError] = useState('');

  const [filterVendor, setFilterVendor] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');

  const fileRef = useRef(null);
  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [v, r] = await Promise.all([loadVendors(orgId), loadAllVendorReviews(orgId)]);
    setVendors(v);
    setReviews(r);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const computeScore = (backendResult, rating) => {
    const bertweetPred = backendResult?.bertweet?.prediction || 'Neutral';
    const bertweetConf = backendResult?.bertweet?.confidence || 0;
    const robertaPred = backendResult?.roberta?.prediction || 'Neutral';
    const robertaConf = backendResult?.roberta?.confidence || 0;
    const bertweetScore = sentimentToScore(bertweetPred);
    const robertaScore = sentimentToScore(robertaPred);
    const modelAvg = (bertweetScore + robertaScore) / 2;
    const sentimentW = Number(settings.sentimentWeight || 50);
    const ratingW = Number(settings.ratingWeight || 50);
    const finalScore = ((modelAvg * sentimentW) + (Number(rating) * ratingW)) / 100;
    const finalSentiment = scoreToSentiment(finalScore);
    return { bertweetPred, bertweetConf, robertaPred, robertaConf, finalScore, finalSentiment };
  };

  const saveReviewResult = async (payload) => {
    await saveVendorReview(payload);
    await upsertVendorScore(payload.vendor_name, payload.rating, payload.final_sentiment, payload.final_score, orgId);
    await upsertCustomer(payload.customer_name, payload.vendor_name, payload.rating, payload.customer_review, orgId);
  };

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

    setLoading(true);
    setResult(null);
    setStatus('Running AI analysis and updating vendor score...');
    try {
      const backendResult = await analyzeReviewWithBackend(form.reviewText);
      const { bertweetPred, bertweetConf, robertaPred, robertaConf, finalScore, finalSentiment } = computeScore(backendResult, form.rating);

      const existingScore = await loadVendorScoreByName(form.vendorName, orgId);
      const previousScore = existingScore ? Number(existingScore.vendor_score) : null;
      const newScore = existingScore
        ? ((Number(existingScore.vendor_score) * existingScore.total_reviews) + finalScore) / (existingScore.total_reviews + 1)
        : finalScore;
      const delta = newScore - previousScore;

      await saveReviewResult({
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

      setResult({
        bertweetPred, bertweetConf, robertaPred, robertaConf,
        finalSentiment, finalScore,
        topics: extractTopics(form.reviewText),
        action: suggestAction(finalSentiment, finalScore),
        previousScore, newScore, delta
      });
      setStatus('Review analyzed and vendor score updated successfully.');
      setForm({ customerName: '', vendorName: '', rating: '', reviewText: '' });
      setErrors({});
      showToast('Review submitted and vendor score updated.', 'success');
      await loadData();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      logActivity(orgId, 'analyze', 'review', form.vendorName, `AI analysis failed: ${err.message}`);
      showToast('Analysis failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplate = () => {
    downloadCSV(
      [{ customer_name: 'John Doe', vendor_name: vendors[0]?.vendor_name || 'Acme Corp', rating: 5, review: 'Great quality and fast delivery.' }],
      ['customer_name', 'vendor_name', 'rating', 'review'],
      'review_batch_template.csv'
    );
  };

  const handleExport = () => {
    if (!filteredReviews.length) { showToast('No reviews to export.', 'info'); return; }
    const rows = filteredReviews.map(r => ({
      vendor_name: r.vendor_name,
      customer_name: r.customer_name,
      rating: r.rating,
      review: r.customer_review,
      sentiment: r.final_sentiment,
      score: r.final_score
    }));
    downloadCSV(rows, ['vendor_name', 'customer_name', 'rating', 'review', 'sentiment', 'score'], 'review_export.csv');
    showToast('Review history exported.', 'success');
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result));
        if (!rows.length) { setCsvError('CSV file is empty or missing headers.'); return; }
        handleBatchSubmit(rows);
      } catch (err) {
        setCsvError(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleBatchSubmit = async (rows) => {
    setBatchLoading(true);
    setBatchSummary(null);
    setCsvError('');
    setBatchProgress('');

    const validRows = [];
    rows.forEach((row, i) => {
      const vendor = (row.vendor_name || '').trim();
      const customer = (row.customer_name || '').trim();
      const review = (row.review || row.customer_review || row.review_text || '').trim();
      const rating = Number(row.rating);
      if (!vendor || !customer || !review || !rating || rating < 1 || rating > 5) return;
      if (!vendors.some(v => v.vendor_name === vendor)) return;
      validRows.push({ index: i + 2, vendor, customer, review, rating });
    });

    if (!validRows.length) {
      setCsvError('No valid rows found. Ensure vendors are approved and columns are customer_name, vendor_name, rating, review.');
      setBatchLoading(false);
      return;
    }

    try {
      setStatus(`Batch processing ${validRows.length} reviews...`);
      const results = await analyzeReviewsBatch(validRows.map(r => r.review));
      let succeeded = 0;
      const failures = [];

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const backendResult = results[i] || {};
        try {
          const { bertweetPred, bertweetConf, robertaPred, robertaConf, finalScore, finalSentiment } = computeScore(backendResult, row.rating);
          await saveReviewResult({
            customer_name: row.customer,
            vendor_name: row.vendor,
            organization_id: orgId,
            rating: row.rating,
            customer_review: row.review,
            bertweet_prediction: bertweetPred,
            bertweet_confidence: bertweetConf,
            roberta_prediction: robertaPred,
            roberta_confidence: robertaConf,
            final_sentiment: finalSentiment,
            final_score: finalScore
          });
          succeeded++;
        } catch (err) {
          failures.push(`Row ${row.index} (${row.customer}): ${err.message}`);
          logActivity(orgId, 'analyze', 'review', row.vendor, `AI analysis failed: ${err.message}`);
        }
        setBatchProgress(`${i + 1}/${validRows.length}`);
      }

      setBatchSummary({ total: validRows.length, succeeded, failed: failures.length, failures });
      setStatus(`Batch complete: ${succeeded} of ${validRows.length} reviews succeeded.`);
      showToast(`Batch complete: ${succeeded}/${validRows.length} succeeded.`, succeeded === validRows.length ? 'success' : 'info');
      await loadData();
    } catch (err) {
      setCsvError(`Batch failed: ${err.message}`);
      setStatus(`Error: ${err.message}`);
      showToast('Batch analysis failed. Please try again.', 'error');
    } finally {
      setBatchLoading(false);
      setBatchProgress('');
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const filteredReviews = reviews.filter(r => {
    if (filterVendor && r.vendor_name !== filterVendor) return false;
    if (filterRating) {
      const val = Number(r.rating);
      if (filterRating === '5' && val !== 5) return false;
      if (filterRating === '4' && val < 4) return false;
      if (filterRating === '3' && val < 3) return false;
      if (filterRating === '2' && val > 2) return false;
    }
    if (filterKeyword && !(r.customer_review || '').toLowerCase().includes(filterKeyword.toLowerCase())) return false;
    return true;
  });

  const trend = buildTrend(reviews);
  const aspects = analyzeAspects(reviews);

  const textColor = themeColor('--text', '#2d2a26');
  const mutedColor = themeColor('--text-muted', '#6f5f53');
  const gridColor = themeColor('--shadow-dark', 'rgba(61,50,41,0.18)');
  const accentColor = themeColor('--accent', '#c4755d');

  const trendData = {
    labels: trend.labels,
    datasets: [{
      label: 'Avg Vendor Score',
      data: trend.data,
      borderColor: accentColor,
      backgroundColor: themeColor('--accent2', '#7a8b6e'),
      borderWidth: 3,
      tension: 0.35,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: accentColor
    }]
  };
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { labels: { color: textColor, font: { weight: 700, size: 13 }, usePointStyle: true } }
    },
    scales: {
      y: {
        min: 0,
        max: 5,
        ticks: { stepSize: 1, color: mutedColor, font: { weight: 600 } },
        grid: { color: gridColor },
        border: { color: gridColor }
      },
      x: {
        ticks: { color: textColor, font: { weight: 600 }, autoSkip: true, maxTicksLimit: 8 },
        grid: { display: false },
        border: { color: gridColor }
      }
    }
  };

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
              <label htmlFor="customerName">Customer Name</label>
              <input id="customerName" type="text" placeholder="Enter customer name" value={form.customerName} onChange={set('customerName')} className={errors.customerName ? 'input-error' : ''} />
              {errors.customerName && <div className="field-error">{errors.customerName}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="vendorName">Vendor Name</label>
              <select id="vendorName" value={form.vendorName} onChange={set('vendorName')} className={errors.vendorName ? 'input-error' : ''}>
                <option value="">Select approved vendor</option>
                {vendors.map(v => <option key={v.vendor_name} value={v.vendor_name}>{v.vendor_name}</option>)}
              </select>
              {errors.vendorName && <div className="field-error">{errors.vendorName}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="rating">Rating (1 to 5)</label>
              <select id="rating" value={form.rating} onChange={set('rating')} className={errors.rating ? 'input-error' : ''}>
                <option value="">Select rating</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} - {['Very Poor','Poor','Average','Good','Excellent'][n-1]}</option>)}
              </select>
              {errors.rating && <div className="field-error">{errors.rating}</div>}
            </div>
            <div className="form-group">
              <div className="field-label-row">
                <label htmlFor="reviewText">Customer Review</label>
                <span className="char-count">{form.reviewText.length}/2000</span>
              </div>
              <textarea id="reviewText" rows="6" maxLength="2000" placeholder="Write the customer review here." value={form.reviewText} onChange={set('reviewText')} className={errors.reviewText ? 'input-error' : ''} />
              {errors.reviewText && <div className="field-error">{errors.reviewText}</div>}
            </div>
            <button type="submit" className="analyze-btn" disabled={loading || batchLoading}>
              {loading
                ? <span className="btn-loading"><span className="spinner" aria-hidden="true" /> Analyzing with AI...</span>
                : 'Analyze with AI'}
            </button>
          </form>
        </div>
        <div className="analytics-result-card">
          <h2>Analysis Result</h2>
          <div className="analysis-status">{status}</div>

          {loading && (
            <div className="skeleton-box" aria-busy="true" aria-label="Analyzing review">
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
          )}

          {result && (
            <div className="analysis-result-box">
              <div className="sentiment-row">
                <span className={`sentiment-badge sentiment-${result.finalSentiment.toLowerCase()}`}>{result.finalSentiment}</span>
              </div>
              {result.topics.length > 0 && (
                <div className="topic-tags">
                  <span className="topic-label">Key Topics:</span>
                  {result.topics.map(t => <span key={t} className="tag-pill">{t}</span>)}
                </div>
              )}
              <div className="action-box">
                <strong>Suggested Action:</strong>
                <p>{result.action}</p>
              </div>
              <div className="score-impact">
                <span>Updated Score:</span>
                <strong>
                  {result.previousScore !== null
                    ? `${Number(result.previousScore).toFixed(2)} → ${Number(result.newScore).toFixed(2)} (${result.delta >= 0 ? '+' : ''}${Number(result.delta).toFixed(2)})`
                    : `New vendor score: ${Number(result.newScore).toFixed(2)}`}
                </strong>
              </div>
              <hr />
              <div className="result-row"><span>BERTweet Prediction</span><strong>{result.bertweetPred}</strong></div>
              <div className="result-row"><span>BERTweet Confidence</span><strong>{Number(result.bertweetConf).toFixed(4)}</strong></div>
              <div className="result-row"><span>RoBERTa Prediction</span><strong>{result.robertaPred}</strong></div>
              <div className="result-row"><span>RoBERTa Confidence</span><strong>{Number(result.robertaConf).toFixed(4)}</strong></div>
              <hr />
              <div className="result-row"><span>Final Sentiment</span><strong>{result.finalSentiment}</strong></div>
              <div className="result-row"><span>Final Vendor Score</span><strong>{Number(result.finalScore).toFixed(2)}</strong></div>
            </div>
          )}

          <div className="batch-box">
            <div className="batch-header">
              <h3>Batch Processing</h3>
              <button type="button" className="link-btn" onClick={handleTemplate}>Download CSV Template</button>
            </div>
            <p className="batch-hint">Upload a CSV with columns: customer_name, vendor_name, rating, review.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="visually-hidden" />
            <button type="button" className="analyze-btn" onClick={() => fileRef.current?.click()} disabled={batchLoading || loading}>
              {batchLoading
                ? <span className="btn-loading"><span className="spinner" aria-hidden="true" /> Processing batch... {batchProgress && `(${batchProgress})`}</span>
                : 'Upload CSV for Batch Analysis'}
            </button>
            {csvError && <div className="field-error">{csvError}</div>}
            {batchSummary && (
              <div className="batch-summary">
                <p>Processed <strong>{batchSummary.succeeded}</strong> of <strong>{batchSummary.total}</strong> reviews successfully.</p>
                {batchSummary.failed > 0 && (
                  <ul className="batch-failures">
                    {batchSummary.failures.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-box">
          <h3>Historical Review Trends</h3>
          <div className="chart-canvas-wrap">
            {trend.labels.length > 1
              ? <Line data={trendData} options={trendOptions} />
              : <p className="chart-empty">Add more reviews over time to see score trends.</p>}
          </div>
        </div>
        <div className="chart-box">
          <h3>Aspect-Based Rating Breakdown</h3>
          {aspects.every(a => a.count === 0)
            ? <p className="chart-empty">No aspect mentions found yet. Submit reviews to populate.</p>
            : (
              <div className="aspect-list">
                {aspects.map(a => (
                  <div className="aspect-row" key={a.key}>
                    <div className="aspect-head">
                      <span>{a.label}</span>
                      <strong>{a.count ? `${a.pct}%` : '—'}</strong>
                    </div>
                    <div className="aspect-track">
                      <div className={`aspect-fill${a.count ? '' : ' aspect-empty'}`} style={{ width: `${a.pct}%` }} />
                    </div>
                    <small className="aspect-count">{a.count} review{a.count === 1 ? '' : 's'}</small>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <div className="vendor-table-card">
        <div className="table-header">
          <h3>Review History</h3>
          <button type="button" className="link-btn" onClick={handleExport}>Export CSV</button>
        </div>
        <div className="filter-bar">
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} aria-label="Filter by vendor">
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.vendor_name} value={v.vendor_name}>{v.vendor_name}</option>)}
          </select>
          <select value={filterRating} onChange={e => setFilterRating(e.target.value)} aria-label="Filter by rating">
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars &amp; Up</option>
            <option value="3">3 Stars &amp; Up</option>
            <option value="2">2 Stars &amp; Under</option>
          </select>
          <input type="text" placeholder="Search review keyword..." value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)} aria-label="Search reviews" />
        </div>
        <div className="table-wrapper">
          <table className="vendor-score-table">
            <thead><tr><th>Vendor</th><th>Customer</th><th>Rating</th><th>Review</th><th>Sentiment</th><th>Score</th><th>Date</th></tr></thead>
            <tbody>
              {filteredReviews.length === 0 ? <tr><td colSpan="7">No reviews match the current filters.</td></tr> :
                filteredReviews.slice(0, 15).map((r, i) => (
                  <tr key={`${r.created_at}-${i}`}>
                    <td>{r.vendor_name}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.rating}</td>
                    <td className="review-cell" title={r.customer_review}>{r.customer_review}</td>
                    <td><span className={`sentiment-badge sentiment-${(r.final_sentiment || 'neutral').toLowerCase()}`}>{r.final_sentiment || '-'}</span></td>
                    <td>{r.final_score ? Number(r.final_score).toFixed(2) : '-'}</td>
                    <td>{formatDateTime(r.created_at)}</td>
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
