-- supabase-templates-migration.sql
-- Adds scenario_templates table + default_template_id on profiles
-- Deploy via Supabase SQL Editor

-- ── 1. Create scenario_templates table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scenario_templates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL DEFAULT get_my_tenant_id(),
  created_by_user_id  uuid        DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  name                text        NOT NULL,
  description         text        NOT NULL DEFAULT '',
  is_global           boolean     NOT NULL DEFAULT false,
  loan_purpose        text        NOT NULL DEFAULT 'purchase',
  calculation_data    jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS scenario_templates_tenant_idx
  ON public.scenario_templates (tenant_id);
CREATE INDEX IF NOT EXISTS scenario_templates_user_idx
  ON public.scenario_templates (created_by_user_id);
CREATE INDEX IF NOT EXISTS scenario_templates_global_idx
  ON public.scenario_templates (tenant_id, is_global);

-- ── 3. updated_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS templates_set_updated_at ON public.scenario_templates;
CREATE TRIGGER templates_set_updated_at
  BEFORE UPDATE ON public.scenario_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_templates_updated_at();

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.scenario_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal read own and global templates" ON public.scenario_templates;
DROP POLICY IF EXISTS "Internal create templates" ON public.scenario_templates;
DROP POLICY IF EXISTS "Own or admin update templates" ON public.scenario_templates;
DROP POLICY IF EXISTS "Own or admin delete templates" ON public.scenario_templates;

-- SELECT: internal/admin see own templates OR global templates in their tenant
CREATE POLICY "Internal read own and global templates"
  ON public.scenario_templates FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
    AND (created_by_user_id = auth.uid() OR is_global = true)
  );

-- INSERT: internal/admin only (tenant_id defaults automatically)
CREATE POLICY "Internal create templates"
  ON public.scenario_templates FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- UPDATE: own templates OR admin can update any in tenant
CREATE POLICY "Own or admin update templates"
  ON public.scenario_templates FOR UPDATE
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
    AND (created_by_user_id = auth.uid() OR get_my_role() = 'admin')
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
    AND (created_by_user_id = auth.uid() OR get_my_role() = 'admin')
  );

-- DELETE: own templates OR admin can delete any in tenant
CREATE POLICY "Own or admin delete templates"
  ON public.scenario_templates FOR DELETE
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
    AND (created_by_user_id = auth.uid() OR get_my_role() = 'admin')
  );

-- ── 5. Add default_template_id to profiles ─────────────────────────────────
-- (Must come after scenario_templates is created so the FK reference resolves)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_template_id uuid
    REFERENCES public.scenario_templates(id) ON DELETE SET NULL;
