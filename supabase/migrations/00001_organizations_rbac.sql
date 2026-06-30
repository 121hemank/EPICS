-- ============================================================
-- EPICS Vendor CRM - Multi-tenancy & RBAC Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Organization members (RBAC)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Add organization_id to all existing tables
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE vendor_scores ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_scores_org ON vendor_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_org ON vendor_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper: get the current user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
$$;

-- Helper: check if a user has a role in an organization
CREATE OR REPLACE FUNCTION check_org_role(_org_id UUID, _role TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND status = 'active'
      AND (_role IS NULL OR role = _role)
  )
$$;

-- ---- organizations ----
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (check_org_role(id, 'admin'))
  WITH CHECK (check_org_role(id, 'admin'));

-- ---- organization_members ----
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can manage members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND check_org_role(organization_id, 'admin')
  );

CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  USING (check_org_role(organization_id, 'admin'))
  WITH CHECK (check_org_role(organization_id, 'admin'));

CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  USING (check_org_role(organization_id, 'admin'));

-- ---- vendors ----
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendors in their org"
  ON vendors FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Managers+ can insert vendors"
  ON vendors FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

CREATE POLICY "Managers+ can update vendors"
  ON vendors FOR UPDATE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

CREATE POLICY "Admins can delete vendors"
  ON vendors FOR DELETE
  USING (check_org_role(organization_id, 'admin'));

-- ---- vendor_scores ----
ALTER TABLE vendor_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendor scores in their org"
  ON vendor_scores FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Employees+ can insert vendor scores"
  ON vendor_scores FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Managers+ can update vendor scores"
  ON vendor_scores FOR UPDATE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

-- ---- vendor_reviews ----
ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendor reviews in their org"
  ON vendor_reviews FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Employees+ can insert vendor reviews"
  ON vendor_reviews FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- ---- customers ----
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customers in their org"
  ON customers FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Employees+ can insert customers"
  ON customers FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Managers+ can update customers"
  ON customers FOR UPDATE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

-- ---- leads ----
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leads in their org"
  ON leads FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Employees+ can insert leads"
  ON leads FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Managers+ can update leads"
  ON leads FOR UPDATE
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND (check_org_role(organization_id, 'admin') OR check_org_role(organization_id, 'manager'))
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  USING (check_org_role(organization_id, 'admin'));
