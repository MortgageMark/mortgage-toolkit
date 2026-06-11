-- ─────────────────────────────────────────────────────────────────────────────
-- HLT → LMT Push: link a scenario to the deal it created in Loan Manager
-- Run once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add lmt_deal_id column to scenarios table
--    Nullable UUID → links to the lmt_deals row that was created for this scenario
--    ON DELETE SET NULL: if the LMT deal is deleted the scenario keeps its own data
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS lmt_deal_id uuid
    REFERENCES public.lmt_deals(id) ON DELETE SET NULL;

-- 2. Index for fast lookup (e.g. "which scenario spawned deal X?")
CREATE INDEX IF NOT EXISTS idx_scenarios_lmt_deal_id
  ON public.scenarios(lmt_deal_id)
  WHERE lmt_deal_id IS NOT NULL;
