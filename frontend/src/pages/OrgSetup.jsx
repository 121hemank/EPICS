import { useState } from 'react';
import { createOrganization } from '../lib/supabase';
import { showToast } from '../utils/toast';

export default function OrgSetup() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Create your company workspace.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage('Please enter an organization name.');
      return;
    }
    setLoading(true);
    setMessage('Creating organization...');
    try {
      const org = await createOrganization(name.trim());
      localStorage.setItem('epics_current_org_id', org.id);
      showToast('Organization created!', 'success');
      window.location.href = '/';
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      showToast('Failed to create organization.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Set Up Your Workspace</h1>
        <p>Create your company organization to get started with VendorCRM.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Company name (e.g. Acme Corp)"
            required
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
        <div className="auth-message">{message}</div>
      </div>
    </div>
  );
}
