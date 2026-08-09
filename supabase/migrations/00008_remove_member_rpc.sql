-- ============================================================
-- EPICS Vendor CRM - Remove Member RPC
-- Run this in your Supabase SQL editor
-- ============================================================

-- Removes a member from an organization as an admin.
-- SECURITY DEFINER so RLS can't silently skip the DELETE.
-- The prevent_last_admin_loss trigger still applies.
CREATE OR REPLACE FUNCTION remove_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_email TEXT;
BEGIN
  IF NOT check_org_role(p_org_id, 'admin') THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  DELETE FROM organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 AND v_email IS NOT NULL THEN
    DELETE FROM invitations
    WHERE organization_id = p_org_id
      AND lower(email) = lower(v_email)
      AND status = 'pending';
  END IF;

  RETURN v_count > 0;
END;
$$;
