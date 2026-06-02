-- supabase-partner-invite-migration.sql
-- Adds invite-by-email support to scenario_shares.
-- A "pending" share has shared_with_user_id = NULL and shared_with_email set.
-- When the invited partner signs up, resolvePendingSharesForUser() fills in
-- shared_with_user_id and the share becomes live.

-- 1. Add new columns
ALTER TABLE public.scenario_shares
  ADD COLUMN IF NOT EXISTS shared_with_email text,
  ADD COLUMN IF NOT EXISTS invited_role      text; -- "realtor" | "builder"

-- 2. Index for fast lookup at signup time
CREATE INDEX IF NOT EXISTS scenario_shares_pending_email_idx
  ON public.scenario_shares (shared_with_email)
  WHERE shared_with_user_id IS NULL;

-- 3. RLS: allow a newly-signed-up user to read/update their own pending shares
--    (so resolvePendingSharesForUser can UPDATE without service-role key)
--    Drop old recipient SELECT policy and recreate to include email match.

-- SELECT: existing user_id match OR email match (for pending resolution)
DROP POLICY IF EXISTS "Partners can view shares addressed to them" ON public.scenario_shares;
CREATE POLICY "Partners can view shares addressed to them"
  ON public.scenario_shares FOR SELECT
  USING (
    shared_with_user_id = auth.uid()
    OR (shared_with_user_id IS NULL AND lower(shared_with_email) = lower(auth.jwt() ->> 'email'))
  );

-- UPDATE: allow the invited user to claim their pending shares on signup
DROP POLICY IF EXISTS "Partners can claim pending shares by email" ON public.scenario_shares;
CREATE POLICY "Partners can claim pending shares by email"
  ON public.scenario_shares FOR UPDATE
  USING (
    shared_with_user_id IS NULL
    AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    shared_with_user_id = auth.uid()
  );
