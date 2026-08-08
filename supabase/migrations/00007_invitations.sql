-- ============================================================
-- EPICS Vendor CRM - Token-Based Member Invitations
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Invitations table (works whether or not the person has signed up)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'analyst', 'viewer', 'employee')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitations of their org"
  ON invitations FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()) AND check_org_role(organization_id, 'admin'));

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (check_org_role(organization_id, 'admin'));

-- 2. Lookup an auth user id by email.
--    SECURITY DEFINER so the client (anon key) can read auth.users.
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1
$$;

-- 3. Accept an invitation for the current authenticated user.
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM invitations
  WHERE token = p_token AND status = 'pending';

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation link';
  END IF;

  IF lower(v_inv.email) <> lower((SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role, status)
  VALUES (v_inv.organization_id, auth.uid(), v_inv.role, 'active')
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET status = 'active', role = EXCLUDED.role;

  UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$$;
