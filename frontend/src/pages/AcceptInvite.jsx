import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { acceptInvitation } from '../lib/supabase';

export default function AcceptInvite() {
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus('signed-out');
      setMessage('You need to sign in to accept this invitation.');
      return;
    }
    if (!token) {
      setStatus('error');
      setMessage('Missing invitation token. Please use the invite link you were given.');
      return;
    }
    setStatus('working');
    acceptInvitation(token)
      .then(() => {
        setStatus('success');
        setMessage('You have joined the organization. Redirecting...');
        setTimeout(() => window.location.replace('/'), 1500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [authLoading, user, token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Invitation</h1>
        {status === 'working' && <div className="auth-message">Accepting invitation...</div>}
        {status === 'success' && <div className="auth-message">{message}</div>}
        {status === 'error' && <div className="auth-message">{message}</div>}
        {status === 'signed-out' && (
          <>
            <div className="auth-message">{message}</div>
            <div className="auth-form" style={{ marginTop: 14 }}>
              <Link to="/login" className="analyze-btn" style={{ textAlign: 'center' }}>Sign In</Link>
              <Link to="/signup" className="analyze-btn" style={{ textAlign: 'center' }}>Create Account</Link>
            </div>
            <div className="auth-alt">After signing in, open the invite link again to accept.</div>
          </>
        )}
      </div>
    </div>
  );
}
