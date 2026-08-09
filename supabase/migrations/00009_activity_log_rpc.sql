-- ============================================================
-- EPICS Vendor CRM - Activity Log RPC
-- Run this in your Supabase SQL editor
-- ============================================================

-- Loads an org's activity logs with the actor's email.
-- SECURITY DEFINER so the client (anon key) can read auth.users.
CREATE OR REPLACE FUNCTION get_org_activity_logs(p_org_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user_id UUID,
  user_email TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT check_org_role(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT a.id, a.organization_id, a.user_id, u.email::TEXT AS user_email,
         a.action, a.entity_type, a.entity_id, a.entity_name, a.details, a.created_at
  FROM activity_logs a
  LEFT JOIN auth.users u ON u.id = a.user_id
  WHERE a.organization_id = p_org_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;
