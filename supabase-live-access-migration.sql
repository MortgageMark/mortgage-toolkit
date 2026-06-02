-- supabase-live-access-migration.sql
-- Adds email-based scenario access for live session invites.
--
-- Problem: The borrower claim system requires scenarios.contact_id to be set.
-- When an LO sends a "Live Session" link, the borrower may not have a linked
-- contact yet. This migration adds shared_with_email to scenario_shares so an
-- LO can grant read access by email address, bypassing the contact_id requirement.
--
-- Deploy in Supabase SQL Editor. Run once.

-- ── 1. Add shared_with_email column ─────────────────────────────────────────

ALTER TABLE public.scenario_shares
  ADD COLUMN IF NOT EXISTS shared_with_email text;

-- Fast lookup by email (case-insensitive)
CREATE INDEX IF NOT EXISTS scenario_shares_email_idx
  ON public.scenario_shares (lower(shared_with_email))
  WHERE shared_with_email IS NOT NULL;

-- ── 2. RLS on scenario_shares: email-invited users can read their own record ─

DROP POLICY IF EXISTS "Email-invited: read own share record" ON public.scenario_shares;

CREATE POLICY "Email-invited: read own share record"
  ON public.scenario_shares FOR SELECT
  USING (
    shared_with_email IS NOT NULL
    AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

-- ── 3. RLS on scenarios: email-invited users can view the scenario ───────────
-- Intentionally omits tenant_id check so newly-signed-up borrowers whose
-- profile tenant_id is not yet set can still access the scenario they were
-- explicitly invited to. Single-tenant safe; revisit for SaaS multi-tenant.

DROP POLICY IF EXISTS "Email-invited: view scenario" ON public.scenarios;

CREATE POLICY "Email-invited: view scenario"
  ON public.scenarios FOR SELECT
  USING (
    id IN (
      SELECT scenario_id
      FROM public.scenario_shares
      WHERE shared_with_email IS NOT NULL
        AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── 4. Verify ────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'scenario_shares' AND column_name = 'shared_with_email';
-- SELECT policyname FROM pg_policies WHERE tablename = 'scenarios' ORDER BY policyname;
-- SELECT policyname FROM pg_policies WHERE tablename = 'scenario_shares' ORDER BY policyname;
