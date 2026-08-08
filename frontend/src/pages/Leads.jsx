import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { useSettings } from '../context/SettingsContext';
import MetricCard from '../components/shared/MetricCard';
import Modal from '../components/shared/Modal';
import { loadLeads, saveLead, updateLead, deleteLeadById, upsertVendorFromLead, deleteVendorByLead } from '../lib/supabase';
import { notifyVendorApproved } from '../lib/api';
import { formatDateTime, getPriorityBadge, getStageBadgeClass, getStatusBadgeClass } from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import { showToast } from '../utils/toast';
import Pagination, { usePagination, getPaginatedData } from '../components/shared/Pagination';

export default function Leads() {
  const { currentOrg } = useOrganization();
  const { settings } = useSettings();
  const [allLeads, setAllLeads] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [page, setPage] = useState(1);

  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const data = await loadLeads(orgId);
    setAllLeads(data);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(allLeads.filter(l =>
      ((l.vendor_name || '').toLowerCase().includes(q) || (l.contact_person || '').toLowerCase().includes(q) || (l.contact_email || '').toLowerCase().includes(q)) &&
      (!stageFilter || l.stage === stageFilter) &&
      (!priorityFilter || l.priority === priorityFilter) &&
      (!statusFilter || l.status === statusFilter)
    ));
  }, [search, stageFilter, priorityFilter, statusFilter, allLeads]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      vendor_name: fd.get('vendor_name'),
      contact_person: fd.get('contact_person'),
      contact_email: fd.get('contact_email'),
      contact_phone: fd.get('contact_phone'),
      stage: fd.get('stage'),
      priority: fd.get('priority'),
      status: fd.get('status'),
      notes: fd.get('notes'),
      organization_id: orgId
    };
    if (!payload.vendor_name || !payload.contact_person) {
      showToast('Vendor name and contact person are required.', 'error'); return;
    }
    try {
      await saveLead(payload);
      await loadData();
      e.target.reset();
      showToast('Lead added successfully.', 'success');
    } catch (err) {
      showToast(`Failed to save lead: ${err.message}`, 'error');
    }
  };

  const openEdit = (lead) => {
    setEditLead(lead);
    setEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      vendor_name: fd.get('vendor_name'),
      contact_person: fd.get('contact_person'),
      contact_email: fd.get('contact_email'),
      contact_phone: fd.get('contact_phone'),
      stage: fd.get('stage'),
      priority: fd.get('priority'),
      status: fd.get('status'),
      notes: fd.get('notes')
    };
    try {
      await updateLead(editLead.id, payload, orgId);
      setEditModal(false);
      await loadData();
      showToast('Lead updated successfully.', 'success');
    } catch (err) {
      showToast(`Failed to update lead: ${err.message}`, 'error');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateLead(id, { status }, orgId);
      await loadData();
      showToast(`Lead marked as ${status}.`, 'success');
    } catch { showToast('Failed to update lead status.', 'error'); }
  };

  const handleConvert = async (id) => {
    const lead = allLeads.find(l => Number(l.id) === Number(id));
    if (!lead) return;
    try {
      await upsertVendorFromLead(lead, orgId);
      await updateLead(id, { status: 'Won', stage: 'Closing' }, orgId);
      if (lead.contact_email && settings.emailOnVendorApproved) {
        notifyVendorApproved({
          email: lead.contact_email,
          vendor_name: lead.vendor_name,
          org_name: currentOrg?.name,
          sendgrid_api_key: settings.sendgridApiKey || undefined,
          from_email: settings.sendgridFromEmail || undefined
        }, settings.backendUrl).catch(() => {});
      }
      await loadData();
      showToast('Lead converted to active vendor.', 'success');
    } catch { showToast('Failed to convert lead.', 'error'); }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this lead?')) return;
    try {
      await updateLead(id, { status: 'On Hold' }, orgId);
      await loadData();
      showToast('Lead archived successfully.', 'success');
    } catch { showToast('Failed to archive lead.', 'error'); }
  };

  const handleDelete = async (id) => {
    const lead = allLeads.find(l => Number(l.id) === Number(id));
    if (!lead) return;
    if (!window.confirm(`Delete this lead and its linked vendor?\n\nVendor: ${lead.vendor_name}`)) return;
    try {
      await deleteVendorByLead(lead);
      await deleteLeadById(id, orgId, lead.vendor_name);
      await loadData();
      showToast('Lead and vendor deleted successfully.', 'success');
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleDownload = () => {
    const data = allLeads.map(l => ({
      'Vendor Name': l.vendor_name || '',
      'Contact Person': l.contact_person || '',
      'Contact Email': l.contact_email || '',
      'Contact Phone': l.contact_phone || '',
      'Stage': l.stage || '',
      'Priority': l.priority || '',
      'Status': l.status || '',
      'Created At': formatDateTime(l.created_at)
    }));
    downloadCSV(data, ['Vendor Name', 'Contact Person', 'Contact Email', 'Contact Phone', 'Stage', 'Priority', 'Status', 'Created At'], 'vendor_leads_report.csv');
  };

  const paginated = getPaginatedData(filtered, page, 25);
  const { totalPages } = usePagination(filtered, 25);

  const openLeads = allLeads.filter(l => (l.status || '').toLowerCase() === 'open').length;
  const highLeads = allLeads.filter(l => (l.priority || '').toLowerCase() === 'high').length;

  useEffect(() => { setPage(1); }, [search, stageFilter, priorityFilter, statusFilter]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Vendor Lead Management</h1>
          <p>Add and manage vendor leads for onboarding and follow-up.</p>
        </div>
      </div>
      <div className="vendor-dashboard-grid">
        <MetricCard title="Total Leads" value={allLeads.length} />
        <MetricCard title="Open Leads" value={openLeads} />
        <MetricCard title="High Priority Leads" value={highLeads} />
      </div>

      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Add New Vendor Lead</h2>
          <form className="vendor-review-form" onSubmit={handleFormSubmit}>
            <div className="form-group"><label>Vendor Name</label><input type="text" name="vendor_name" placeholder="Enter vendor name" required /></div>
            <div className="form-group"><label>Contact Person</label><input type="text" name="contact_person" placeholder="Enter contact person name" required /></div>
            <div className="form-group"><label>Contact Email</label><input type="email" name="contact_email" placeholder="Enter contact email" /></div>
            <div className="form-group"><label>Contact Phone</label><input type="text" name="contact_phone" placeholder="Enter contact phone" /></div>
            <div className="form-group">
              <label>Lead Stage</label>
              <select name="stage" required>
                <option value="Prospecting">Prospecting</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closing">Closing</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" required>
                <option value="High">High</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" required>
                <option value="Open">Open</option>
                <option value="Contacted">Contacted</option>
                <option value="Follow-up">Follow-up</option>
                <option value="On Hold">On Hold</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div className="form-group"><label>Notes</label><textarea name="notes" rows="5" placeholder="Enter notes"></textarea></div>
            <button type="submit" className="analyze-btn">Save Lead</button>
          </form>
        </div>
        <div className="analytics-result-card">
          <h2>Lead Summary</h2>
          <div className="analysis-status">No lead action yet.</div>
        </div>
      </div>

      <div className="review-history-card">
        <div className="table-header"><h3>Vendor Leads</h3></div>
        <div className="customer-tools">
          <input type="text" placeholder="Search vendor lead..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="analyze-btn" onClick={handleDownload}>Download CSV</button>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All Stages</option>
            <option value="Prospecting">Prospecting</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closing">Closing</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Contacted">Contacted</option>
            <option value="Follow-up">Follow-up</option>
            <option value="On Hold">On Hold</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
        <div className="table-wrapper">
          <table id="leadsTable">
            <thead>
              <tr><th>Vendor</th><th>Contact Person</th><th>Email</th><th>Phone</th><th>Stage</th><th>Priority</th><th>Status</th><th>Created At</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="9">No leads available yet.</td></tr> :
                paginated.map(l => (
                  <tr key={l.id}>
                    <td>{l.vendor_name}</td><td>{l.contact_person}</td><td>{l.contact_email || '-'}</td><td>{l.contact_phone || '-'}</td>
                    <td><span className={getStageBadgeClass(l.stage)}>{l.stage}</span></td>
                    <td><span className={getPriorityBadge(l.priority).className}>{l.priority}</span></td>
                    <td><span className={getStatusBadgeClass(l.status)}>{l.status}</span></td>
                    <td>{formatDateTime(l.created_at)}</td>
                    <td>
                      <div className="lead-actions">
                        <button className="action-btn edit-btn" onClick={() => openEdit(l)}>Edit</button>
                        <button className="action-btn won-btn" onClick={() => handleConvert(l.id)}>Convert</button>
                        <button className="action-btn lost-btn" onClick={() => handleStatusUpdate(l.id, 'Lost')}>Lost</button>
                        <button className="action-btn delete-btn" onClick={() => handleArchive(l.id)}>Archive</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete(l.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Lead">
        {editLead && (
          <form className="vendor-review-form" onSubmit={handleEditSubmit}>
            <input type="hidden" name="id" value={editLead.id} />
            <div className="form-group"><label>Vendor Name</label><input type="text" name="vendor_name" defaultValue={editLead.vendor_name} required /></div>
            <div className="form-group"><label>Contact Person</label><input type="text" name="contact_person" defaultValue={editLead.contact_person} required /></div>
            <div className="form-group"><label>Contact Email</label><input type="email" name="contact_email" defaultValue={editLead.contact_email || ''} /></div>
            <div className="form-group"><label>Contact Phone</label><input type="text" name="contact_phone" defaultValue={editLead.contact_phone || ''} /></div>
            <div className="form-group">
              <label>Stage</label>
              <select name="stage" defaultValue={editLead.stage || 'Prospecting'}>
                <option value="Prospecting">Prospecting</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closing">Closing</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" defaultValue={editLead.priority || 'Medium'}>
                <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" defaultValue={editLead.status || 'Open'}>
                <option value="Open">Open</option><option value="Contacted">Contacted</option><option value="Follow-up">Follow-up</option>
                <option value="On Hold">On Hold</option><option value="Won">Won</option><option value="Lost">Lost</option>
              </select>
            </div>
            <div className="form-group"><label>Notes</label><textarea name="notes" rows="4" defaultValue={editLead.notes || ''} /></div>
            <button type="submit" className="analyze-btn">Update Lead</button>
          </form>
        )}
      </Modal>
    </>
  );
}
