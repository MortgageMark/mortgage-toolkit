-- supabase-partner-contacts-migration.sql
-- Adds RLS policies so Realtors and Builders can manage their own contacts
-- (contacts they created), independent of the internal team's contacts.
-- Also updates the existing email-match policy to include 'builder' role.
-- Run in Supabase SQL Editor.

-- ── Drop old email-match policy and recreate to include builder ───────────────
DROP POLICY IF EXISTS "Borrowers can view own contact record" ON public.contacts;

CREATE POLICY "Borrowers can view own contact record"
  ON public.contacts
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('borrower', 'realtor', 'builder')
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

-- ── Partner SELECT: realtors/builders see contacts they created ───────────────
DROP POLICY IF EXISTS "Partners can view their own created contacts" ON public.contacts;

CREATE POLICY "Partners can view their own created contacts"
  ON public.contacts
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('realtor', 'builder')
    AND created_by_user_id = auth.uid()
  );

-- ── Partner INSERT: realtors/builders can create contacts ────────────────────
DROP POLICY IF EXISTS "Partners can insert their own contacts" ON public.contacts;

CREATE POLICY "Partners can insert their own contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('realtor', 'builder')
    AND created_by_user_id = auth.uid()
  );

-- ── Partner UPDATE: realtors/builders can edit contacts they created ──────────
DROP POLICY IF EXISTS "Partners can update their own created contacts" ON public.contacts;

CREATE POLICY "Partners can update their own created contacts"
  ON public.contacts
  FOR UPDATE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('realtor', 'builder')
    AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('realtor', 'builder')
    AND created_by_user_id = auth.uid()
  );
