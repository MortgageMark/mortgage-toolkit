-- supabase-team-scenarios-sharing-migration.sql
-- Extends "LOs see their scoped scenarios" to also allow LOA/Processors to read
-- their team lead's scenarios when team_share_contacts = true.
-- Requires: my_team_shares_contacts() function (from supabase-team-contacts-sharing-migration.sql)

-- ── 1. Drop and recreate the scoped policy ────────────────────────────────────
DROP POLICY IF EXISTS "LOs see their scoped scenarios" ON public.scenarios;

CREATE POLICY "LOs see their scoped scenarios"
  ON public.scenarios FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'internal'
    AND (
      -- Own scenarios
      user_id = auth.uid()
      -- Team lead's scenarios when the lead has sharing enabled
      OR (
        public.my_team_shares_contacts()
        AND user_id = (
          SELECT team_lead_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- ── 2. Verify ─────────────────────────────────────────────────────────────────
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'scenarios' AND cmd = 'SELECT'
ORDER BY policyname;
