-- supabase-global-rate-config-migration.sql
-- Creates a single global interest rate config row per tenant.
-- LOs write to it; all authenticated users (including builders) can read it.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.global_rate_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  market_rate text        NOT NULL DEFAULT '6.750',
  floor_rate  text        NOT NULL DEFAULT '5.500',
  rate_date   text        NOT NULL DEFAULT '',
  step_costs  jsonb       NOT NULL DEFAULT '{}',
  updated_by  uuid        REFERENCES public.profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_rate_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the tenant can read the rate config
DROP POLICY IF EXISTS "Tenant members can read global rate config" ON public.global_rate_config;
CREATE POLICY "Tenant members can read global rate config"
  ON public.global_rate_config
  FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

-- Only internal users (LOs/admins) can insert or update
DROP POLICY IF EXISTS "Internal users can upsert global rate config" ON public.global_rate_config;
CREATE POLICY "Internal users can upsert global rate config"
  ON public.global_rate_config
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

DROP POLICY IF EXISTS "Internal users can update global rate config" ON public.global_rate_config;
CREATE POLICY "Internal users can update global rate config"
  ON public.global_rate_config
  FOR UPDATE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );
