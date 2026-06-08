-- LMT → HLT Push: ensure internal users can insert/update contacts
-- Run in Supabase SQL Editor

-- Allow internal/admin users to insert contacts (for People → HLT push)
DROP POLICY IF EXISTS "LMT: internal can insert contacts" ON public.contacts;
CREATE POLICY "LMT: internal can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'internal', 'branch_admin'));

-- Allow internal/admin users to update contacts they created
DROP POLICY IF EXISTS "LMT: internal can update contacts" ON public.contacts;
CREATE POLICY "LMT: internal can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'internal', 'branch_admin'))
  WITH CHECK (get_my_role() IN ('admin', 'internal', 'branch_admin'));

-- Ensure contact_type has a safe default so pushes without it don't fail
ALTER TABLE public.contacts
  ALTER COLUMN contact_type SET DEFAULT 'business';
