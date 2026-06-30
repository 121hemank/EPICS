import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from './AuthContext';
import { showToast } from '../utils/toast';

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setMembership(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('*, organization:organizations(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      const orgs = (memberships || []).map(m => m.organization);
      setOrganizations(orgs);
      setMembership(memberships?.[0] || null);
      setMembers([]);

      const storedOrgId = localStorage.getItem('epics_current_org_id');
      const target = storedOrgId && orgs.find(o => o.id === storedOrgId)
        ? orgs.find(o => o.id === storedOrgId)
        : orgs[0] || null;

      setCurrentOrg(target);

      if (target) {
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('*, user:auth.users!inner(id, email)')
          .eq('organization_id', target.id);
        setMembers(orgMembers || []);
        const current = (memberships || []).find(m => m.organization_id === target.id);
        setMembership(current || null);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const switchOrg = useCallback(async (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (!org) return;
    localStorage.setItem('epics_current_org_id', orgId);
    setCurrentOrg(org);

    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('*, user:auth.users!inner(id, email)')
      .eq('organization_id', orgId);
    setMembers(orgMembers || []);

    const { data: memberships } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single();
    setMembership(memberships || null);
  }, [organizations, user]);

  const refreshMembers = useCallback(async () => {
    if (!currentOrg) return;
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('*, user:auth.users!inner(id, email)')
      .eq('organization_id', currentOrg.id);
    setMembers(orgMembers || []);
  }, [currentOrg]);

  const role = membership?.role || null;
  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'manager';

  return (
    <OrganizationContext.Provider value={{
      organizations,
      currentOrg,
      membership,
      members,
      role,
      isAdmin,
      isManager,
      loading,
      switchOrg,
      refreshMembers,
      reloadOrgs: loadOrgs,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
