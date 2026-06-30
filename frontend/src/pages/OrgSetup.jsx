import { useState } from 'react';
import { supabase } from '../lib/supabase-client';
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
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setMessage('Error: You must be logged in.');
        setLoading(false);
        return;
      }

      const uuid = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

      const { error: orgError } = await supabase
        .from('organizations')
        .insert([{ id: uuid, name: name.trim() }]);
      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: uuid,
          user_id: user.id,
          role: 'admin',
          status: 'active'
        }]);
      if (memberError) throw memberError;

      localStorage.setItem('epics_current_org_id', uuid);
      setMessage('Created! Redirecting...');
      window.location.replace('/');
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
