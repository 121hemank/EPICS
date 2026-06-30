-- Fix RLS infinite recursion: make helper functions SECURITY DEFINER
-- so they bypass RLS when querying organization_members internally.

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION check_org_role(_org_id UUID, _role TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND status = 'active'
      AND (_role IS NULL OR role = _role)
  )
$$;
