import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, createOrganization } from '../lib/supabase';

export default function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Create a new account.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage('Creating account...');
      const data = await signUp(email, password);
      if (data?.user) {
        try {
          await createOrganization(companyName.trim() || 'My Company');
          setMessage('Account created! Redirecting...');
          window.location.href = '/';
          return;
        } catch {
          // Org creation failed — user may need email confirmation
        }
      }
      setMessage('Account created! Check your email for the confirmation link.');
      setTimeout(() => window.location.href = '/login', 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Signup</h1>
        <p>Create your VendorCRM account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="text" placeholder="Company name (optional)" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          <input type="email" placeholder="Enter email" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Enter password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Create Account</button>
        </form>
        <div className="auth-message">{message}</div>
        <div className="auth-alt">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
