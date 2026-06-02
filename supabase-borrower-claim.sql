-- supabase-borrower-claim.sql
-- Enables borrowers to discover and claim scenarios that were linked to a
-- contact record with their email address by an internal user.
--
-- RUN THIS after supabase-contacts.sql is deployed.
-- Safe to run multiple times (uses IF NOT EXISTS / DROP IF EXISTS pattern).

-- ─── SELECT policy ────────────────────────────────────────────────────────────
-- Allows a borrower to see scenarios they haven't claimed yet, provided the
-- scenario is linked to a contact whose email matches their auth email.
-- This is additive to the existing "Users can read own scenarios" policy.

DROP POLICY IF EXISTS "Borrowers can view scenarios linked to them" ON public.scenarios;

CREATE POLICY "Borrowers can view scenarios linked to them"
ON public.scenarios FOR SELECT
USING (
  get_my_tenant_id() = tenant_id
  AND get_my_role() = 'borrower'
  AND contact_id IN (
    SELECT id FROM public.contacts
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
      AND tenant_id = get_my_tenant_id()
  )
);

-- ─── UPDATE policy ────────────────────────────────────────────────────────────
-- Allows a borrower to set user_id = their own auth.uid() on a scenario that
-- is linked to a contact with their email. The WITH CHECK prevents them from
-- doing anything other than claiming ownership for themselves.

DROP POLICY IF EXISTS "Borrowers can claim scenarios linked to them" ON public.scenarios;

CREATE POLICY "Borrowers can claim scenarios linked to them"
ON public.scenarios FOR UPDATE
USING (
  get_my_tenant_id() = tenant_id
  AND get_my_role() = 'borrower'
  AND contact_id IN (
    SELECT id FROM public.contacts
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
      AND tenant_id = get_my_tenant_id()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = get_my_tenant_id()
);
