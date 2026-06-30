import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrganization } from '../context/OrganizationContext';
import MetricCard from '../components/shared/MetricCard';
import { loadVendorScores, loadVendors, loadLeads, loadCustomers, loadVendorScoreByName, loadVendorReviewsByName } from '../lib/supabase';
import { formatDateTime, getCustomerStatus } from '../utils/helpers';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { currentOrg } = useOrganization();
  const [searchParams] = useSearchParams();
  const [vendorScores, setVendorScores] = useState([]);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorDetail, setVendorDetail] = useState(null);
  const [vendorReviews, setVendorReviews] = useState([]);

  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [vs, av, ld, cust] = await Promise.all([
      loadVendorScores(orgId), loadVendors(orgId), loadLeads(orgId), loadCustomers(orgId)
    ]);
    const approvedNames = av.map(v => v.vendor_name);
    setVendorScores(vs.filter(v => approvedNames.includes(v.vendor_name)));
    setApprovedVendors(av);
    setLeads(ld);
    setCustomers(cust);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const sq = searchParams.get('search');
    if (sq) {
      const found = [...approvedVendors, ...customers, ...leads].find(
        item => (item.vendor_name || item.customer_name || '').toLowerCase().includes(sq.toLowerCase())
      );
      if (found) {
        if (found.vendor_name) setSelectedVendor(found.vendor_name);
      }
    }
  }, [searchParams, approvedVendors, customers, leads]);

  useEffect(() => {
    if (!selectedVendor || !orgId) { setVendorDetail(null); setVendorReviews([]); return; }
    (async () => {
      const [vs, vr] = await Promise.all([loadVendorScoreByName(selectedVendor, orgId), loadVendorReviewsByName(selectedVendor, orgId)]);
      setVendorDetail(vs);
      setVendorReviews(vr);
    })();
  }, [selectedVendor, orgId]);

  const totalReviews = vendorScores.reduce((s, v) => s + Number(v.total_reviews || 0), 0);
  const avgScore = vendorScores.length ? (vendorScores.reduce((s, v) => s + Number(v.vendor_score || 0), 0) / vendorScores.length) : 0;
  const activeVendors = approvedVendors.filter(v => (v.onboarding_status || '').toLowerCase() === 'active').length;
  const wonLeads = leads.filter(l => (l.status || '').toLowerCase() === 'won').length;
  const lostLeads = leads.filter(l => (l.status || '').toLowerCase() === 'lost').length;
  const highPriorityLeads = leads.filter(l => (l.priority || '').toLowerCase() === 'high').length;

  const top6 = [...vendorScores].sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score)).slice(0, 6);

  const lineData = {
    labels: top6.map(v => v.vendor_name),
    datasets: [{ label: 'Vendor Score', data: top6.map(v => Number(v.vendor_score || 0)), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', borderWidth: 3, tension: 0.35, fill: false }]
  };
  const lineOptions = { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, min: 0, max: 5 } } };

  const stageCounts = { Prospecting: 0, Negotiation: 0, Closing: 0, Won: 0, Lost: 0 };
  leads.forEach(l => {
    const status = (l.status || '').toLowerCase();
    const stage = (l.stage || '').toLowerCase();
    if (status === 'won') stageCounts.Won++;
    else if (status === 'lost') stageCounts.Lost++;
    else if (stage === 'prospecting') stageCounts.Prospecting++;
    else if (stage === 'negotiation') stageCounts.Negotiation++;
    else if (stage === 'closing') stageCounts.Closing++;
  });
  const hasStageData = Object.values(stageCounts).some(v => v > 0);

  const donutData = hasStageData ? {
    labels: Object.keys(stageCounts),
    datasets: [{ data: Object.values(stageCounts), backgroundColor: ['#2563eb', '#22c55e', '#f59e0b', '#10b981', '#ef4444'], borderWidth: 2 }]
  } : null;

  const customersWithStatus = customers.map(c => ({ ...c, computedStatus: getCustomerStatus(c.latest_review_date) }));

  return (
    <>
      <div className="vendor-dashboard-grid">
        <MetricCard title="Total Vendors" value={approvedVendors.length} />
        <MetricCard title="Total Reviews" value={totalReviews} />
        <MetricCard title="Average Vendor Score" value={avgScore.toFixed(2)} />
        <MetricCard title="Active Vendors" value={activeVendors} />
      </div>
      <div className="vendor-dashboard-grid">
        <MetricCard title="Total Leads" value={leads.length} />
        <MetricCard title="Won Leads" value={wonLeads} />
        <MetricCard title="Lost Leads" value={lostLeads} />
        <MetricCard title="High Priority Leads" value={highPriorityLeads} />
      </div>

      <div className="charts-row">
        <div className="chart-box">
          <h3>Top Vendor Scores</h3>
          <div className="chart-canvas-wrap">
            {top6.length > 0 && <Line data={lineData} options={lineOptions} />}
          </div>
        </div>
        <div className="chart-box">
          <h3>Lead Stage Distribution</h3>
          <div className="chart-canvas-wrap">
            {donutData && <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'top' } } }} />}
          </div>
        </div>
      </div>

      <div className="vendor-table-card">
        <div className="table-header"><h3>Vendor Score Summary</h3></div>
        <div className="table-wrapper">
          <table className="vendor-score-table">
            <thead><tr><th>Vendor</th><th>Total Reviews</th><th>Avg Rating</th><th>Positive</th><th>Neutral</th><th>Negative</th><th>Vendor Score</th></tr></thead>
            <tbody>
              {vendorScores.length === 0 ? <tr><td colSpan="7">No vendor data available yet.</td></tr> :
                vendorScores.map(v => (
                  <tr key={v.vendor_name}>
                    <td>{v.vendor_name}</td><td>{v.total_reviews}</td><td>{Number(v.avg_rating).toFixed(2)}</td>
                    <td>{v.positive_reviews}</td><td>{v.neutral_reviews}</td><td>{v.negative_reviews}</td>
                    <td>{Number(v.vendor_score).toFixed(2)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div className="vendor-details-card">
        <div className="table-header"><h3>Vendor Insights</h3></div>
        <div className="vendor-search-box">
          <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
            <option value="">Select vendor to view details</option>
            {approvedVendors.map(v => <option key={v.vendor_name} value={v.vendor_name}>{v.vendor_name}</option>)}
          </select>
        </div>
        <div className="vendor-details-summary">
          {!selectedVendor ? 'Select a vendor to view score summary and reviews.' :
            !vendorDetail ? `No score summary found for vendor: ${selectedVendor}` :
            <div>
              <strong>Vendor:</strong> {vendorDetail.vendor_name}<br />
              <strong>Total Reviews:</strong> {vendorDetail.total_reviews}<br />
              <strong>Average Rating:</strong> {Number(vendorDetail.avg_rating).toFixed(2)}<br />
              <strong>Positive:</strong> {vendorDetail.positive_reviews} | {' '}
              <strong>Neutral:</strong> {vendorDetail.neutral_reviews} | {' '}
              <strong>Negative:</strong> {vendorDetail.negative_reviews}<br />
              <strong>Vendor Score:</strong> {Number(vendorDetail.vendor_score).toFixed(2)}
            </div>
          }
        </div>
        <div className="table-wrapper">
          <table className="review-history-table">
            <thead><tr><th>Customer</th><th>Rating</th><th>Review</th><th>BERTweet</th><th>RoBERTa</th><th>Final Sentiment</th><th>Final Score</th><th>Date</th></tr></thead>
            <tbody>
              {vendorReviews.length === 0 ? <tr><td colSpan="8">No reviews found for this vendor.</td></tr> :
                vendorReviews.map((r, i) => (
                  <tr key={i}>
                    <td>{r.customer_name}</td><td>{r.rating}</td><td>{r.customer_review}</td>
                    <td>{r.bertweet_prediction || '-'}</td><td>{r.roberta_prediction || '-'}</td>
                    <td>{r.final_sentiment || '-'}</td>
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
