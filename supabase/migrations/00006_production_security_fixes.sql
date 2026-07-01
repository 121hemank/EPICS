-- ============================================================
-- EPICS Vendor CRM - Security Fixes for Production
-- Idempotent - safe to run multiple times
-- ============================================================

-- ============================================================
-- 1. CRITICAL: Fix SECURITY DEFINER functions
--    - Schema-qualify table references as public.organization_members
--    - SET search_path = public to prevent schema hijacking
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
$$;

ALTER FUNCTION get_user_org_ids() SET search_path = public;

CREATE OR REPLACE FUNCTION check_org_role(_org_id UUID, _role TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND status = 'active'
      AND (_role IS NULL OR role = _role)
  )
$$;

ALTER FUNCTION check_org_role(_org_id UUID, _role TEXT) SET search_path = public;


-- ============================================================
-- 2. CRITICAL: Fix self-insert privilege escalation
--    Drop the policy that lets any authenticated user add
--    themselves to any organization. Only admins can insert
--    members (via the "Admins can manage members" policy).
-- ============================================================

DROP POLICY IF EXISTS "Users can add themselves to organizations" ON organization_members;


-- ============================================================
-- 3. Add missing DELETE / UPDATE policies
-- ============================================================

-- 3a. organizations DELETE (admins only)
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;
CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  USING (check_org_role(id, 'admin'));

-- 3b. vendor_scores DELETE (admins / managers)
DROP POLICY IF EXISTS "Managers+ can delete vendor scores" ON vendor_scores;
CREATE POLICY "Managers+ can delete vendor scores"
  ON vendor_scores FOR DELETE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

-- 3c. vendor_reviews UPDATE (admins / managers)
DROP POLICY IF EXISTS "Managers+ can update vendor reviews" ON vendor_reviews;
CREATE POLICY "Managers+ can update vendor reviews"
  ON vendor_reviews FOR UPDATE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

-- 3d. vendor_reviews DELETE (admins / managers)
DROP POLICY IF EXISTS "Managers+ can delete vendor reviews" ON vendor_reviews;
CREATE POLICY "Managers+ can delete vendor reviews"
  ON vendor_reviews FOR DELETE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

-- 3e. customers DELETE (admins / managers)
DROP POLICY IF EXISTS "Managers+ can delete customers" ON customers;
CREATE POLICY "Managers+ can delete customers"
  ON customers FOR DELETE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );


-- ============================================================
-- 4. Add NOT NULL constraint on organization_id
--    (only after RLS policies are fixed to ensure every row
--     belongs to an organization)
-- ============================================================

ALTER TABLE vendors ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE vendor_scores ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE vendor_reviews ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN organization_id SET NOT NULL;


-- ============================================================
-- 5. Add CHECK constraints on activity_logs
-- ============================================================

ALTER TABLE activity_logs ADD CONSTRAINT IF NOT EXISTS chk_activity_logs_action
  CHECK (action IN ('create', 'update', 'delete', 'invite', 'convert'));

ALTER TABLE activity_logs ADD CONSTRAINT IF NOT EXISTS chk_activity_logs_entity_type
  CHECK (entity_type IN ('organization', 'member', 'vendor', 'customer', 'lead', 'review', 'score'));


-- ============================================================
-- 6. Fix activity_logs RLS to use helper functions
-- ============================================================

DROP POLICY IF EXISTS "Users can view activity logs in their org" ON activity_logs;
CREATE POLICY "Users can view activity logs in their org"
  ON activity_logs FOR SELECT
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND check_org_role(organization_id)
  );

DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_logs;
CREATE POLICY "Users can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND check_org_role(organization_id)
  );


-- ============================================================
-- 7. Add composite indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user_org ON public.organization_members(user_id, organization_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON public.organization_members(organization_id, role) WHERE status = 'active';


-- ============================================================
-- 8. Add updated_at trigger function and apply to organizations
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 9. Fix organization_members.invited_by FK
--    Drop existing FK (CASCADE → delete) and re-create
--    with ON DELETE SET NULL
-- ============================================================

ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_invited_by_fkey;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
