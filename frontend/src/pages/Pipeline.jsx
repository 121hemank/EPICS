import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import MetricCard from '../components/shared/MetricCard';
import Modal from '../components/shared/Modal';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import { loadLeads, updateLead } from '../lib/supabase';
import { getPriorityBadge, getStatusBadgeClass } from '../utils/helpers';
import { showToast } from '../utils/toast';

function getNextStage(stage) {
  const s = (stage || '').toLowerCase();
  if (s === 'prospecting') return 'Negotiation';
  if (s === 'negotiation') return 'Closing';
  return stage;
}

function getPrevStage(stage) {
  const s = (stage || '').toLowerCase();
  if (s === 'closing') return 'Negotiation';
  if (s === 'negotiation') return 'Prospecting';
  return stage;
}

const columns = ['Prospecting', 'Negotiation', 'Closing', 'Won', 'Lost'];

export default function Pipeline() {
  const { currentOrg } = useOrganization();
  const [leads, setLeads] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
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
      const data = await loadLeads(orgId);
      setLeads(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(leads.filter(l =>
      ((l.vendor_name || '').toLowerCase().includes(q) || (l.contact_person || '').toLowerCase().includes(q)) &&
      (!priorityFilter || l.priority === priorityFilter) &&
      (!statusFilter || l.status === statusFilter)
    ));
  }, [search, priorityFilter, statusFilter, leads]);

  const moveForward = async (id, stage) => {
    try {
      await updateLead(id, { stage: getNextStage(stage) });
      await loadData();
      showToast(`Lead moved to ${getNextStage(stage)}.`, 'success');
    } catch { showToast('Failed to move lead.', 'error'); }
  };

  const moveBackward = async (id, stage) => {
    try {
      await updateLead(id, { stage: getPrevStage(stage) });
      await loadData();
      showToast(`Lead moved back to ${getPrevStage(stage)}.`, 'success');
    } catch { showToast('Failed to move lead.', 'error'); }
  };

  const markWon = async (id) => {
    try {
      await updateLead(id, { status: 'Won', stage: 'Closing' });
      await loadData();
      showToast('Lead marked as Won.', 'success');
    } catch { showToast('Failed to mark lead as Won.', 'error'); }
  };

  const markLost = async (id) => {
    try {
      await updateLead(id, { status: 'Lost' });
      await loadData();
      showToast('Lead marked as Lost.', 'success');
    } catch { showToast('Failed to mark lead as Lost.', 'error'); }
  };

  const getColumnLeads = (col) => {
    const colLower = col.toLowerCase();
    if (colLower === 'won') return filtered.filter(l => (l.status || '').toLowerCase() === 'won');
    if (colLower === 'lost') return filtered.filter(l => (l.status || '').toLowerCase() === 'lost');
    return filtered.filter(l =>
      (l.stage || '').toLowerCase() === colLower &&
      (l.status || '').toLowerCase() !== 'won' &&
      (l.status || '').toLowerCase() !== 'lost'
    );
  };

  if (loading) return <LoadingSkeleton type="card" count={6} />;
  if (error) return <div className="error-state"><p>Failed to load pipeline data: {error}</p><button onClick={() => window.location.reload()}>Try Again</button></div>;
  if (leads.length === 0) return <div className="empty-state"><h3>No Pipeline Data</h3><p>Leads will appear here once added. Create a lead to get started.</p></div>;

  const wonTotal = filtered.filter(l => (l.status || '').toLowerCase() === 'won').length;
  const highTotal = filtered.filter(l => (l.priority || '').toLowerCase() === 'high').length;

  return (
    <>
      <div className="page-header"><div><h1>Vendor Pipeline</h1><p>Track vendor leads across business stages.</p></div></div>
      <div className="vendor-dashboard-grid">
        <MetricCard title="Total Pipeline Leads" value={filtered.length} />
        <MetricCard title="Won Leads" value={wonTotal} />
        <MetricCard title="High Priority" value={highTotal} />
      </div>
      <div className="customer-tools">
        <input type="text" placeholder="Search pipeline lead..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option><option value="Contacted">Contacted</option><option value="Follow-up">Follow-up</option>
          <option value="On Hold">On Hold</option><option value="Won">Won</option><option value="Lost">Lost</option>
        </select>
      </div>
      <div className="pipeline-board">
        {columns.map(col => {
          const colLeads = getColumnLeads(col);
          return (
            <div key={col} className="pipeline-column">
              <div className="pipeline-column-header">
                <h3>{col}</h3>
                <span>{colLeads.length}</span>
              </div>
              <div className="pipeline-cards">
                {colLeads.length === 0 ? <p className="pipeline-empty">No leads in this stage.</p> :
                  colLeads.map(l => {
                    const stage = (l.stage || '').toLowerCase();
                    const status = (l.status || '').toLowerCase();
                    const canBack = stage !== 'prospecting' && status !== 'won' && status !== 'lost';
                    const canNext = stage !== 'closing' && status !== 'won' && status !== 'lost';
                    const canWon = status !== 'won';
                    const canLost = status !== 'lost';
                    return (
                      <div key={l.id} className="pipeline-card" onClick={() => { setDetailLead(l); setDetailModal(true); }}>
                        <h4>{l.vendor_name}</h4>
                        <p><strong>Contact:</strong> {l.contact_person || '-'}</p>
                        <p><strong>Email:</strong> {l.contact_email || '-'}</p>
                        <p><strong>Phone:</strong> {l.contact_phone || '-'}</p>
                        <div className="card-badges">
                          <span className={getPriorityBadge(l.priority).className}>{l.priority}</span>
                          <span className={getStatusBadgeClass(l.status)}>{l.status}</span>
                        </div>
                        <div className="lead-actions" style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                          {canBack && <button className="action-btn edit-btn" onClick={() => moveBackward(l.id, l.stage)}>Back</button>}
                          {canNext && <button className="action-btn won-btn" onClick={() => moveForward(l.id, l.stage)}>Next</button>}
                          {canWon && <button className="action-btn won-btn" onClick={() => markWon(l.id)}>Won</button>}
                          {canLost && <button className="action-btn lost-btn" onClick={() => markLost(l.id)}>Lost</button>}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="Lead Details">
        {detailLead && (
          <div className="vendor-details-summary">
            <strong>Vendor:</strong> {detailLead.vendor_name}<br />
            <strong>Contact Person:</strong> {detailLead.contact_person || '-'}<br />
            <strong>Email:</strong> {detailLead.contact_email || '-'}<br />
            <strong>Phone:</strong> {detailLead.contact_phone || '-'}<br />
            <strong>Stage:</strong> {detailLead.stage || '-'}<br />
            <strong>Priority:</strong> {detailLead.priority || '-'}<br />
            <strong>Status:</strong> {detailLead.status || '-'}<br />
            <strong>Notes:</strong> {detailLead.notes || '-'}<br />
            <strong>Created At:</strong> {detailLead.created_at ? new Date(detailLead.created_at).toLocaleString() : '-'}
          </div>
        )}
      </Modal>
    </>
  );
}
