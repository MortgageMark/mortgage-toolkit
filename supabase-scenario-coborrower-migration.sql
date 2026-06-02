-- supabase-scenario-coborrower-migration.sql
-- Adds co-borrower access to scenarios.
-- A co-borrower is a second contact on the loan whose email is matched
-- at login to give them read-only view access to the same scenario.
--
-- Deploy AFTER supabase-borrower-claim.sql is already live.

-- ── 1. Add column to scenarios ───────────────────────────────────────────────
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS co_borrower_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

-- ── 2. Index for fast lookup ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS scenarios_co_borrower_contact_id_idx
  ON public.scenarios (co_borrower_contact_id);

-- ── 3. RLS: co-borrower can SELECT scenarios they are listed on ──────────────
-- Mirrors the primary-borrower SELECT policy in supabase-borrower-claim.sql
-- but checks co_borrower_contact_id instead of contact_id.
-- Co-borrowers get read-only access — there is no UPDATE / claim path for them.
CREATE POLICY "Co-borrowers can view their scenarios"
  ON public.scenarios
  FOR SELECT
  USING (
    co_borrower_contact_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.id = scenarios.co_borrower_contact_id
        AND lower(c.email) = lower(auth.jwt() ->> 'email')
    )
  );
