import { useState, useEffect, useCallback } from 'react';
import { loadVendorScores, loadVendors, loadAllVendorReviews } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function Performance() {
  const [vendorScores, setVendorScores] = useState([]);
  const [allReviews, setAllReviews] = useState([]);

  const loadData = useCallback(async () => {
    const [vs, av, reviews] = await Promise.all([loadVendorScores(), loadVendors(), loadAllVendorReviews()]);
    const approvedNames = av.map(v => v.vendor_name);
    setVendorScores(vs.filter(v => approvedNames.includes(v.vendor_name)));
    setAllReviews(reviews);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const top6 = [...vendorScores].sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score)).slice(0, 6);

  const barData = {
    labels: top6.map(v => v.vendor_name),
    datasets: [{
      label: 'Vendor Score',
      data: top6.map(v => Number(v.vendor_score || 0)),
      backgroundColor: ['#2563eb', '#22c55e', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4'],
      borderWidth: 1
    }]
  };
  const barOptions = { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, min: 0, max: 5 } } };

  const pos = allReviews.filter(r => r.final_sentiment === 'Positive').length;
  const neu = allReviews.filter(r => r.final_sentiment === 'Neutral').length;
  const neg = allReviews.filter(r => r.final_sentiment === 'Negative').length;
  const hasSentiment = pos + neu + neg > 0;

  const donutData = hasSentiment ? {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{ data: [pos, neu, neg], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 1 }]
  } : null;

  const top5 = [...vendorScores].sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score)).slice(0, 5);

  return (
    <>
      <div className="page-header"><div><h1>Performance Analytics</h1><p>Track vendor score performance and sentiment trends.</p></div></div>
      <div className="performance-grid">
        <div className="chart-card">
          <h3>Vendor Score Overview</h3>
          {top6.length > 0 && <Bar data={barData} options={barOptions} />}
        </div>
        <div className="chart-card">
          <h3>Sentiment Distribution</h3>
          {donutData && <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, animation: false }} />}
        </div>
      </div>
      <div className="top-vendors-card">
        <div className="table-header"><h3>Top Vendors</h3></div>
        <div className="table-wrapper">
          <table className="vendor-score-table">
            <thead><tr><th>Vendor</th><th>Vendor Score</th><th>Total Reviews</th><th>Avg Rating</th></tr></thead>
            <tbody>
              {top5.length === 0 ? <tr><td colSpan="4">No vendor performance data available yet.</td></tr> :
                top5.map(v => (
                  <tr key={v.vendor_name}>
                    <td>{v.vendor_name}</td><td>{Number(v.vendor_score).toFixed(2)}</td>
                    <td>{v.total_reviews}</td><td>{Number(v.avg_rating).toFixed(2)}</td>
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
