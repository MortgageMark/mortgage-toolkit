-- supabase-scenario-tokens-migration.sql
-- Creates the scenario_tokens table for the magic link / tokenized deep link system.
-- Tokens are multi-use, expire after 30 days, and are tied to a specific
-- scenario + destination. Resolution uses the Edge Function with service role
-- so no anon SELECT policy is needed here.
-- Deploy via Supabase SQL Editor.

-- ── 1. Create scenario_tokens table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scenario_tokens (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text        UNIQUE NOT NULL,

  -- Client info (denormalized for fast lookup — no join required on hot path)
  client_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- nullable: client may not have a Supabase auth account yet at token creation time
  client_email      text        NOT NULL,
  client_phone      text,       -- nullable: SMS is optional
  client_name       text        NOT NULL,
  contact_id        uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Scenario + destination
  scenario_id       uuid        NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  destination       text        NOT NULL CHECK (destination IN (
                                  'fee_sheet',
                                  'loan_comparison',
                                  'refi_analysis',
                                  'full_scenario',
                                  'payment_breakdown'
                                )),

  -- Multi-tenancy (defaults automatically for authenticated LOs)
  tenant_id         uuid        NOT NULL DEFAULT get_my_tenant_id()
                                  REFERENCES public.tenants(id),

  -- LO who created this token
  created_by_id     uuid        NOT NULL DEFAULT auth.uid()
                                  REFERENCES auth.users(id),
  created_by_name   text        NOT NULL,

  -- Lifecycle
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active         boolean     NOT NULL DEFAULT true,
  last_accessed_at  timestamptz,
  access_count      integer     NOT NULL DEFAULT 0
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────
-- Unique index on token (enforced by UNIQUE constraint above, but explicit for clarity)
CREATE UNIQUE INDEX IF NOT EXISTS scenario_tokens_token_uidx
  ON public.scenario_tokens (token);

-- Hot path: every link click hits this index first
CREATE INDEX IF NOT EXISTS scenario_tokens_hot_path_idx
  ON public.scenario_tokens (token, is_active, expires_at);

CREATE INDEX IF NOT EXISTS scenario_tokens_client_id_idx
  ON public.scenario_tokens (client_id);

CREATE INDEX IF NOT EXISTS scenario_tokens_tenant_id_idx
  ON public.scenario_tokens (tenant_id);

CREATE INDEX IF NOT EXISTS scenario_tokens_scenario_id_idx
  ON public.scenario_tokens (scenario_id);

-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.scenario_tokens ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ──────────────────────────────────────────────────────────
-- Drop existing policies first (safe for re-runs)
DROP POLICY IF EXISTS "Internal read own tenant tokens"   ON public.scenario_tokens;
DROP POLICY IF EXISTS "Internal insert own tenant tokens" ON public.scenario_tokens;
DROP POLICY IF EXISTS "Internal update own tenant tokens" ON public.scenario_tokens;
DROP POLICY IF EXISTS "Client read own tokens"            ON public.scenario_tokens;

-- SELECT: internal/admin can read all tokens in their tenant
CREATE POLICY "Internal read own tenant tokens"
  ON public.scenario_tokens FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- INSERT: internal/admin only (tenant_id + created_by_id default automatically)
CREATE POLICY "Internal insert own tenant tokens"
  ON public.scenario_tokens FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- UPDATE: internal/admin can deactivate/modify tokens in their tenant
CREATE POLICY "Internal update own tenant tokens"
  ON public.scenario_tokens FOR UPDATE
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- SELECT: authenticated clients can read their own active tokens
-- (Used for "My shared links" views in a future borrower portal)
CREATE POLICY "Client read own tokens"
  ON public.scenario_tokens FOR SELECT
  USING (
    client_id = auth.uid()
    AND is_active = true
    AND expires_at > now()
  );

-- NOTE: Token RESOLUTION (the link click) uses the Edge Function with the
-- Supabase service role key, which bypasses RLS entirely. No anon SELECT
-- policy is needed or desired — tokens are never exposed to the public anon key.
