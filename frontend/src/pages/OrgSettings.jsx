import { useState } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { updateOrganization, inviteMember, updateMemberRole, removeMember } from '../lib/supabase';
import { showToast } from '../utils/toast';

export default function OrgSettings() {
  const { currentOrg, members, role, isAdmin, refreshMembers } = useOrganization();
  const { user } = useAuth();
  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [saving, setSaving] = useState(false);

  if (!currentOrg) {
    return (
      <div className="page-header">
        <h1>Organization Settings</h1>
        <p>No organization selected.</p>
      </div>
    );
  }

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(currentOrg.id, { name: orgName.trim() });
      showToast('Organization name updated.', 'success');
    } catch {
      showToast('Failed to update organization.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await inviteMember(currentOrg.id, inviteEmail.trim(), inviteRole);
      await refreshMembers();
      setInviteEmail('');
      showToast(`Invitation sent to ${inviteEmail}`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateMemberRole(memberId, newRole, currentOrg.id);
      await refreshMembers();
      showToast('Member role updated.', 'success');
    } catch {
      showToast('Failed to update role.', 'error');
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm('Remove this member from the organization?')) return;
    try {
      await removeMember(memberId, currentOrg.id);
      await refreshMembers();
      showToast('Member removed.', 'success');
    } catch {
      showToast('Failed to remove member.', 'error');
    }
  };

  const roleBadgeClass = (r) => {
    switch (r) {
      case 'admin': return 'status-won';
      case 'manager': return 'status-contacted';
      case 'analyst': return 'status-follow-up';
      case 'viewer': return 'status-open';
      case 'employee': return 'status-on-hold';
      default: return '';
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Organization Settings</h1>
        <p>Manage your company workspace and team members.</p>
      </div>

      <div className="analytics-layout">
        <div className="analytics-form-card">
          <h2>Organization Details</h2>
          <form className="vendor-review-form" onSubmit={handleSaveOrg}>
            <div className="form-group">
              <label>Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </div>
            <div className="form-group">
              <label>Your Role</label>
              <div className="analysis-status" style={{ marginTop: 0 }}>
                <span className={`status ${roleBadgeClass(role)}`} style={{ padding: '4px 10px' }}>
                  {role?.charAt(0).toUpperCase() + role?.slice(1) || 'N/A'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <button type="submit" className="analyze-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </form>
        </div>

        {isAdmin && (
          <div className="analytics-form-card">
            <h2>Invite Team Member</h2>
            <form className="vendor-review-form" onSubmit={handleInvite}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Vendor Viewer</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <button type="submit" className="analyze-btn">Send Invitation</button>
            </form>
          </div>
        )}
      </div>

      <div className="vendor-table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><h3>Team Members ({members.length})</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={isAdmin ? 5 : 4}>No members found.</td></tr>
              ) : members.map(m => (
                <tr key={m.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.user_id}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Vendor Viewer</option>
                        <option value="employee">Employee</option>
                      </select>
                    ) : (
                      <span className={`status ${roleBadgeClass(m.role)}`} style={{ padding: '4px 10px' }}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status ${m.status === 'active' ? 'active-status' : 'inactive-status'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'}</td>
                  {isAdmin && (
                    <td>
                      {m.user_id !== user?.id && (
                        <button className="action-btn delete-btn" onClick={() => handleRemove(m.id)}>
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
