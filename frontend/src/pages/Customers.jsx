import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { loadCustomers } from '../lib/supabase';
import { formatDateTime, getCustomerStatus } from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import Pagination, { usePagination, getPaginatedData } from '../components/shared/Pagination';

export default function Customers() {
  const { currentOrg } = useOrganization();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const data = await loadCustomers(orgId);
    setCustomers(data);
    setFiltered(data);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(customers.filter(c =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.vendor_name || '').toLowerCase().includes(q)
    ));
  }, [search, customers]);

  const withStatus = filtered.map(c => ({ ...c, computedStatus: getCustomerStatus(c.latest_review_date) }));
  const paginated = getPaginatedData(withStatus, page, 25);
  const { totalPages } = usePagination(withStatus, 25);

  useEffect(() => { setPage(1); }, [search]);

  const active = withStatus.filter(c => c.computedStatus === 'Active').length;
  const inactive = withStatus.filter(c => c.computedStatus === 'Inactive').length;

  const handleDownload = () => {
    const data = withStatus.map(c => ({
      'Customer Name': c.customer_name,
      'Vendor Name': c.vendor_name || '',
      'Total Reviews': c.total_reviews,
      'Average Rating': Number(c.avg_rating).toFixed(2),
      'Status': c.computedStatus,
      'Latest Review Date': formatDateTime(c.latest_review_date)
    }));
    const headers = ['Customer Name', 'Vendor Name', 'Total Reviews', 'Average Rating', 'Status', 'Latest Review Date'];
    downloadCSV(data, headers, 'customers_report.csv');
  };

  return (
    <>
      <div className="customer-tools">
        <input type="text" placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="analyze-btn" onClick={handleDownload}>Download CSV</button>
      </div>
      <div className="mini-stats">
        <div>Total Customers: <b>{customers.length}</b></div>
        <div>Active: <b style={{ color: '#22c55e' }}>{active}</b></div>
        <div>Inactive: <b style={{ color: '#ef4444' }}>{inactive}</b></div>
      </div>
      <h2>Vendor Customers</h2>
      <div className="table-wrapper">
        <table id="customersTable">
          <thead>
            <tr><th>Customer Name</th><th>Vendor</th><th>Total Reviews</th><th>Avg Rating</th><th>Status</th><th>Latest Review Date</th></tr>
          </thead>
          <tbody>
            {withStatus.length === 0 ? <tr><td colSpan="6">No customer data available yet.</td></tr> :
              paginated.map((c, i) => (
                <tr key={i}>
                  <td>{c.customer_name}</td><td>{c.vendor_name || '-'}</td><td>{c.total_reviews}</td>
                  <td>{Number(c.avg_rating).toFixed(2)}</td>
                  <td><span className={`status ${c.computedStatus === 'Active' ? 'active-status' : 'inactive-status'}`}>{c.computedStatus}</span></td>
                  <td>{formatDateTime(c.latest_review_date)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
