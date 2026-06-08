-- LMT Milestone v2 — dynamic milestones with labels, field configs, lock, turntimes
-- Run in Supabase SQL Editor

-- 1. Drop unique constraint (allows multiple VOEs per deal)
ALTER TABLE public.lmt_milestones
  DROP CONSTRAINT IF EXISTS lmt_milestones_deal_id_milestone_type_key;

-- 2. Add new columns to lmt_milestones
ALTER TABLE public.lmt_milestones
  ADD COLUMN IF NOT EXISTS label         text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order    integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fields_config jsonb       DEFAULT null,
  ADD COLUMN IF NOT EXISTS due_date_locked boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_core       boolean     NOT NULL DEFAULT false;

-- 3. Update milestone_type CHECK to include all types
ALTER TABLE public.lmt_milestones
  DROP CONSTRAINT IF EXISTS lmt_milestones_milestone_type_check;
ALTER TABLE public.lmt_milestones
  ADD CONSTRAINT lmt_milestones_milestone_type_check
  CHECK (milestone_type IN (
    'contract','le','icd','title','appraisal','hoi',
    'voe','vor','flood','payoff','file','other',
    'disclosure'
  ));

-- 4. Per-loan turntime overrides
CREATE TABLE IF NOT EXISTS public.lmt_deal_turntimes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                              REFERENCES public.tenants(id) ON DELETE RESTRICT,
  deal_id         uuid        NOT NULL REFERENCES public.lmt_deals(id) ON DELETE CASCADE,
  milestone_type  text        NOT NULL,
  turntime_days   integer     NOT NULL DEFAULT 3,
  followup_days   integer     NOT NULL DEFAULT 1,
  alert_days_before integer   NOT NULL DEFAULT 1,
  UNIQUE (deal_id, milestone_type)
);

ALTER TABLE public.lmt_deal_turntimes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LMT: internal can manage deal turntimes" ON public.lmt_deal_turntimes;
CREATE POLICY "LMT: internal can manage deal turntimes"
  ON public.lmt_deal_turntimes FOR ALL
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'))
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));
GRANT ALL ON public.lmt_deal_turntimes TO authenticated;
CREATE INDEX IF NOT EXISTS lmt_deal_turntimes_deal_id_idx ON public.lmt_deal_turntimes (deal_id);
