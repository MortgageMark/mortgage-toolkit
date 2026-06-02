-- supabase-signup-contact-migration.sql
-- 1. INSERT policy — lets a newly registered authenticated user create their own
--    contact record on sign-up. tenant_id is auto-set by get_my_tenant_id().
-- 2. UPDATE policy — lets a borrower update their own contact record (matched by
--    email) so they can complete their profile after signing up.
--
-- Run once in Supabase → SQL Editor.

-- ── INSERT policy ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can self-register as a contact" ON public.contacts;

CREATE POLICY "Authenticated users can self-register as a contact"
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ── UPDATE policy (borrower self-update) ─────────────────────────────────────
-- Allows an authenticated user to update ONLY their own contact row, matched
-- by email. This lets borrowers complete their profile (phone, address, etc.)
-- without needing full internal-team access.
DROP POLICY IF EXISTS "Borrowers can update their own contact" ON public.contacts;

CREATE POLICY "Borrowers can update their own contact"
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING  (lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
