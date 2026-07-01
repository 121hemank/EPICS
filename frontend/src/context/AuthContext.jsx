import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import { showToast } from '../utils/toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    }).catch((err) => {
      console.error('Failed to restore auth session:', err);
      setUser(null);
    }).finally(() => {
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('Auth state change error:', err);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data?.user ?? null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
