-- supabase-warning-rules-migration.sql
-- Tenant-scoped custom warning rules for the Payment Calculator.
-- Each rule stores structured conditions (jsonb array) evaluated client-side.
-- Hardcoded default rules live in constants.js; this table holds LO-custom rules only.

CREATE TABLE IF NOT EXISTS public.warning_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id),
  created_by_user_id  uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
  label               text NOT NULL,
  message             text NOT NULL,
  severity            text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'error')),
  -- Array of condition objects: [{ field, op, value }, ...]
  -- All conditions are AND-ed together.
  -- field: loanProgram | occupancy | propType | purpose | ltv | fico | loanAmount | homePrice | pcState
  -- op (enum fields): is | is_not
  -- op (number fields): gt | gte | lt | lte | eq
  conditions          jsonb NOT NULL DEFAULT '[]',
  enabled             boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.warning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_select_warning_rules" ON public.warning_rules
  FOR SELECT USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

CREATE POLICY "internal_insert_warning_rules" ON public.warning_rules
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'internal')
  );

CREATE POLICY "internal_update_warning_rules" ON public.warning_rules
  FOR UPDATE USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  ) WITH CHECK (
    public.get_my_role() IN ('admin', 'internal')
  );

CREATE POLICY "internal_delete_warning_rules" ON public.warning_rules
  FOR DELETE USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_warning_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER warning_rules_updated_at
  BEFORE UPDATE ON public.warning_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_warning_rules_updated_at();
