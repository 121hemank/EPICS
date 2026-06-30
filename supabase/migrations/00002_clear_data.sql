-- ============================================================
-- Clear all existing data to start fresh with multi-tenancy
-- Run this AFTER applying 00001_organizations_rbac.sql
-- ============================================================

-- Disable RLS temporarily for cleanup
ALTER TABLE IF EXISTS organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads DISABLE ROW LEVEL SECURITY;

-- Delete data (order matters due to foreign keys)
DELETE FROM vendor_reviews;
DELETE FROM vendor_scores;
DELETE FROM leads;
DELETE FROM customers;
DELETE FROM vendors;
DELETE FROM organization_members;
DELETE FROM organizations;

-- Re-enable RLS
ALTER TABLE IF EXISTS organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads ENABLE ROW LEVEL SECURITY;
