import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Enter your credentials.');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage('Logging in...');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Login</h1>
        <p>Sign in to access VendorCRM.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="Enter email" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Enter password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Login</button>
        </form>
        <div className="auth-message">{message}</div>
        <div className="auth-alt">
          Don't have an account? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
