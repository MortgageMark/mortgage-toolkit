-- Underwriting conditions per deal
CREATE TABLE IF NOT EXISTS public.lmt_conditions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                          REFERENCES public.tenants(id) ON DELETE RESTRICT,
  deal_id     uuid        NOT NULL REFERENCES public.lmt_deals(id) ON DELETE CASCADE,
  user_id     uuid        DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        text        NOT NULL DEFAULT '',
  condition_type text     NOT NULL DEFAULT 'prior_to_docs'
                          CHECK (condition_type IN ('prior_to_docs','prior_to_funding','prior_to_closing','general')),
  cleared     boolean     NOT NULL DEFAULT false,
  cleared_at  timestamptz,
  cleared_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lmt_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LMT: internal can manage conditions" ON public.lmt_conditions;
CREATE POLICY "LMT: internal can manage conditions"
  ON public.lmt_conditions FOR ALL
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'))
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

GRANT ALL ON public.lmt_conditions TO authenticated;

CREATE INDEX IF NOT EXISTS lmt_conditions_deal_id_idx ON public.lmt_conditions (deal_id);
CREATE INDEX IF NOT EXISTS lmt_conditions_cleared_idx  ON public.lmt_conditions (deal_id, cleared);
