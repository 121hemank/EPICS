-- ============================================================
-- EPICS Vendor CRM - Public Onboarding + Admin Recovery
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Allow the new roles used by the UI. Original constraint
--    (00001) only allowed 'admin','manager','employee'.
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin', 'manager', 'analyst', 'viewer', 'employee'));

-- 2. Source column for leads so public applications can be
--    distinguished (and gated) from internal ones.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal';

-- 3. Public vendor onboarding: anonymous users may insert a lead
--    ONLY when it is marked as a public onboarding application.
--    (Internal members keep using the existing "Employees+ can insert" policy.)
ALTER POLICY "Employees+ can insert leads" ON leads
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    OR (source = 'public_onboarding')
  );

-- 4. Recover owner: promotes the caller to admin for an org where
--    they are an active member and NO active admin currently exists.
--    Safe: cannot be used to hijack an org that already has an admin.
CREATE OR REPLACE FUNCTION recover_org_owner(p_org_id UUID)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  admin_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are not an active member of this organization';
  END IF;

  SELECT COUNT(*) INTO admin_count
  FROM organization_members
  WHERE organization_id = p_org_id
    AND role = 'admin'
    AND status = 'active';

  IF admin_count > 0 THEN
    RAISE EXCEPTION 'Organization already has an admin';
  END IF;

  UPDATE organization_members
  SET role = 'admin'
  WHERE organization_id = p_org_id AND user_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- 5. Hard safety net: never allow the last active admin to be
--    demoted, removed, or deactivated.
CREATE OR REPLACE FUNCTION prevent_last_admin_loss()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  admin_count integer;
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active' THEN
    SELECT COUNT(*) INTO admin_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'admin'
      AND status = 'active'
      AND id <> OLD.id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote or remove the last active admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_loss_trigger ON organization_members;
CREATE TRIGGER prevent_last_admin_loss_trigger
  BEFORE UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_loss();
