-- supabase-scenario-shares-migration.sql
-- Implements scenario-level sharing between LOs and Realtor/Builder partners.
-- Supports two directions:
--   LO → Partner: share a specific client scenario with a partner (share_type = 'share')
--   Partner → LO: refer a client scenario to the mortgage team (share_type = 'referral')
--
-- Future SaaS note: tenant_id is on every row. Cross-tenant sharing will require
-- an additional 'target_tenant_id' column and a separate acceptance workflow.
-- This migration is single-tenant safe and SaaS-ready at the schema level.
--
-- Deploy in Supabase SQL Editor. Run once.

-- ── 1. scenario_shares table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scenario_shares (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL DEFAULT get_my_tenant_id(),
  scenario_id          uuid        NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  shared_by_user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  -- NULL means "shared with the whole team" (used for partner → LO referrals)
  shared_with_user_id  uuid        REFERENCES public.profiles(id),
  share_type           text        NOT NULL DEFAULT 'share'
                                   CHECK (share_type IN ('share', 'referral')),
  permission           text        NOT NULL DEFAULT 'view'
                                   CHECK (permission IN ('view', 'collaborate')),
  note                 text        NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Index for fast look-ups by scenario and recipient
CREATE INDEX IF NOT EXISTS scenario_shares_scenario_idx
  ON public.scenario_shares (scenario_id);
CREATE INDEX IF NOT EXISTS scenario_shares_with_user_idx
  ON public.scenario_shares (shared_with_user_id)
  WHERE shared_with_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scenario_shares_tenant_type_idx
  ON public.scenario_shares (tenant_id, share_type);

-- ── 2. RLS on scenario_shares ────────────────────────────────────────────────

ALTER TABLE public.scenario_shares ENABLE ROW LEVEL SECURITY;

-- Internal users can see all shares within their tenant
CREATE POLICY "Internal: read all shares in tenant"
  ON public.scenario_shares FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- Partners can see shares they sent or received
CREATE POLICY "Partners: read own shares"
  ON public.scenario_shares FOR SELECT
  USING (
    shared_by_user_id  = auth.uid()
    OR shared_with_user_id = auth.uid()
  );

-- Internal can insert (to share with partners)
CREATE POLICY "Internal: insert shares"
  ON public.scenario_shares FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- Partners (realtor/builder) can INSERT referrals (share_type must be 'referral')
CREATE POLICY "Partners: insert referrals"
  ON public.scenario_shares FOR INSERT
  WITH CHECK (
    get_my_role() IN ('realtor', 'builder')
    AND share_type = 'referral'
    AND shared_with_user_id IS NULL   -- team-wide referral, not targeted
    AND shared_by_user_id  = auth.uid()
  );

-- No UPDATE or DELETE — shares are immutable (audit trail)

-- ── 3. New SELECT policy on scenarios for shared access ─────────────────────
-- Partners can read scenarios explicitly shared with them

CREATE POLICY "Shared: partners can view shared scenarios"
  ON public.scenarios FOR SELECT
  USING (
    id IN (
      SELECT scenario_id FROM public.scenario_shares
      WHERE shared_with_user_id = auth.uid()
        AND tenant_id = get_my_tenant_id()
    )
  );

-- Internal users can see scenarios referred to the team (shared_with_user_id IS NULL)
-- Note: internal already has broad SELECT via existing policies, but this makes
-- team referrals visible even if the scenario belongs to a partner user_id.
CREATE POLICY "Shared: internal can view team referrals"
  ON public.scenarios FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    AND id IN (
      SELECT scenario_id FROM public.scenario_shares
      WHERE share_type  = 'referral'
        AND tenant_id   = get_my_tenant_id()
    )
  );

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Run after deploying:
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'scenario_shares';
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'scenarios' ORDER BY policyname;
