-- Branch Invite Code Migration
-- Adds a unique shareable join code to each branch
-- Run in Supabase SQL Editor

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

CREATE INDEX IF NOT EXISTS branches_invite_code_idx
  ON public.branches (invite_code)
  WHERE invite_code IS NOT NULL;

-- Also ensure branches have a tenant_id if not already present
-- (safe no-op if column already exists)
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
