-- ═══════════════════════════════════════════════════════════════════════
-- Home Loan Toolkit — Scenario Locks + Audit Log
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (Run AFTER the schema and profiles files)
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add lock columns to scenarios table
-- ─────────────────────────────────────────────────────────────────────
alter table public.scenarios
  add column if not exists lock_level text not null default 'none'
    check (lock_level in ('none', 'fees', 'full')),
  add column if not exists locked_by uuid references auth.users(id),
  add column if not exists locked_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Audit log table
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.scenario_audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null check (action in (
    'created', 'updated', 'deleted',
    'locked_fees', 'locked_full', 'unlocked',
    'duplicated', 'status_changed'
  )),
  changes     jsonb default '{}'::jsonb,   -- { field: { old, new } }
  note        text default ''
);

-- Index for fast lookups by scenario
create index if not exists idx_audit_scenario
  on public.scenario_audit_log(scenario_id, created_at desc);

-- Index for user activity queries
create index if not exists idx_audit_user
  on public.scenario_audit_log(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS on audit log
-- ─────────────────────────────────────────────────────────────────────
alter table public.scenario_audit_log enable row level security;

-- Users can view audit entries for their own scenarios
create policy "Users can view audit for own scenarios"
  on public.scenario_audit_log for select
  using (
    exists (
      select 1 from public.scenarios
      where scenarios.id = scenario_audit_log.scenario_id
      and scenarios.user_id = auth.uid()
    )
  );

-- Admins can view ALL audit entries
create policy "Admins can view all audit entries"
  on public.scenario_audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Authenticated users can insert audit entries (the app writes these)
create policy "Authenticated users can insert audit entries"
  on public.scenario_audit_log for insert
  with check (auth.uid() = user_id);

-- Nobody can update or delete audit entries (immutable log)
-- (No update/delete policies = denied by default with RLS enabled)
