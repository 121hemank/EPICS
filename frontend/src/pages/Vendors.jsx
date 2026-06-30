import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import MetricCard from '../components/shared/MetricCard';
import Modal from '../components/shared/Modal';
import { loadVendors, updateVendor, deleteVendor, deleteVendorScoresByName, deleteVendorReviewsByName, unlinkCustomerVendor } from '../lib/supabase';
import { formatDateTime, getVendorStatusBadgeClass } from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import { showToast } from '../utils/toast';

export default function Vendors() {
  const { currentOrg } = useOrganization();
  const [vendors, setVendors] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);

  const orgId = currentOrg?.id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const data = await loadVendors(orgId);
    setVendors(data);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(vendors.filter(v =>
      (v.vendor_name || '').toLowerCase().includes(q) ||
      (v.contact_person || '').toLowerCase().includes(q) ||
      (v.contact_email || '').toLowerCase().includes(q)
    ));
  }, [search, vendors]);

  const active = vendors.filter(v => (v.onboarding_status || '').toLowerCase() === 'active').length;
  const inactive = vendors.filter(v => (v.onboarding_status || '').toLowerCase() === 'inactive').length;

  const openEdit = (vendor) => { setEditVendor(vendor); setEditModal(true); };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      vendor_name: fd.get('vendor_name'),
      contact_person: fd.get('contact_person'),
      contact_email: fd.get('contact_email'),
      contact_phone: fd.get('contact_phone'),
      onboarding_status: fd.get('onboarding_status')
    };
    try {
      await updateVendor(editVendor.id, payload);
      setEditModal(false);
      await loadData();
      showToast('Vendor updated successfully.', 'success');
    } catch {
      showToast('Failed to update vendor.', 'error');
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await updateVendor(id, { onboarding_status: status });
      await loadData();
      showToast(`Vendor marked as ${status}.`, 'success');
    } catch { showToast('Failed to update vendor status.', 'error'); }
  };

  const handleDelete = async (id) => {
    const vendor = vendors.find(v => Number(v.id) === Number(id));
    if (!vendor || !window.confirm(`Delete this vendor?\n\nThis will also remove its reviews and scores.`)) return;
    try {
      await deleteVendorScoresByName(vendor.vendor_name);
      await deleteVendorReviewsByName(vendor.vendor_name);
      await unlinkCustomerVendor(vendor.vendor_name);
      await deleteVendor(id);
      await loadData();
      showToast('Vendor and related analytics deleted successfully.', 'success');
    } catch { showToast('Failed to delete vendor.', 'error'); }
  };

  const handleDownload = () => {
    const data = vendors.map(v => ({
      'Vendor Name': v.vendor_name || '',
      'Contact Person': v.contact_person || '',
      'Email': v.contact_email || '',
      'Phone': v.contact_phone || '',
      'Status': v.onboarding_status || '',
      'Created At': formatDateTime(v.created_at)
    }));
    downloadCSV(data, ['Vendor Name', 'Contact Person', 'Email', 'Phone', 'Status', 'Created At'], 'vendors_report.csv');
  };

  return (
    <>
      <div className="page-header">
        <div><h1>Approved Vendors</h1><p>Manage approved vendors available for analytics and scoring.</p></div>
      </div>
      <div className="vendor-dashboard-grid">
        <MetricCard title="Total Vendors" value={vendors.length} />
        <MetricCard title="Active Vendors" value={active} />
        <MetricCard title="Inactive Vendors" value={inactive} />
      </div>
      <div className="review-history-card">
        <div className="table-header"><h3>Vendor Directory</h3></div>
        <div className="customer-tools">
          <input type="text" placeholder="Search vendor..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="analyze-btn" onClick={handleDownload}>Download CSV</button>
        </div>
        <div className="table-wrapper">
          <table id="vendorsTable">
            <thead><tr><th>Vendor Name</th><th>Contact Person</th><th>Email</th><th>Phone</th><th>Status</th><th>Created At</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="7">No approved vendors available yet.</td></tr> :
                filtered.map(v => (
                  <tr key={v.id}>
                    <td>{v.vendor_name}</td><td>{v.contact_person || '-'}</td><td>{v.contact_email || '-'}</td><td>{v.contact_phone || '-'}</td>
                    <td><span className={getVendorStatusBadgeClass(v.onboarding_status)}>{v.onboarding_status}</span></td>
                    <td>{formatDateTime(v.created_at)}</td>
                    <td>
                      <div className="lead-actions">
                        <button className="action-btn edit-btn" onClick={() => openEdit(v)}>Edit</button>
                        <button className="action-btn won-btn" onClick={() => handleStatus(v.id, 'Active')}>Activate</button>
                        <button className="action-btn lost-btn" onClick={() => handleStatus(v.id, 'Inactive')}>Deactivate</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete(v.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Vendor">
        {editVendor && (
          <form className="vendor-review-form" onSubmit={handleEditSubmit}>
            <div className="form-group"><label>Vendor Name</label><input type="text" name="vendor_name" defaultValue={editVendor.vendor_name} required /></div>
            <div className="form-group"><label>Contact Person</label><input type="text" name="contact_person" defaultValue={editVendor.contact_person || ''} /></div>
            <div className="form-group"><label>Email</label><input type="email" name="contact_email" defaultValue={editVendor.contact_email || ''} /></div>
            <div className="form-group"><label>Phone</label><input type="text" name="contact_phone" defaultValue={editVendor.contact_phone || ''} /></div>
            <div className="form-group">
              <label>Onboarding Status</label>
              <select name="onboarding_status" defaultValue={editVendor.onboarding_status || 'Active'}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select>
            </div>
            <button type="submit" className="analyze-btn">Update Vendor</button>
          </form>
        )}
      </Modal>
    </>
  );
}
