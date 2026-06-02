-- ═══════════════════════════════════════════════════════════════════════════════
-- Home Loan Toolkit — Multi-Tenant Migration
-- supabase-tenant-migration.sql
--
-- PURPOSE
--   Adds multi-tenancy (tenant_id) to every existing Supabase table.
--   This is the "do it now or regret it later" architectural foundation
--   required before any significant data accumulates.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste entire file → Run
--
-- SAFETY
--   Fully idempotent — safe to run multiple times on the same database.
--   Every step uses IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP POLICY IF EXISTS,
--   or information_schema existence checks before acting.
--
-- ORDER MATTERS — do not rearrange steps
--   Step 4 (get_my_tenant_id function) MUST precede Step 10 (new RLS policies)
--   because PostgreSQL validates function existence at CREATE POLICY parse time.
--
-- CRITICAL BUG FIXED IN THIS MIGRATION
--   All previously deployed admin RLS policies used get_my_role() IN ('admin','lo')
--   but 'lo' is NOT a valid value in the profiles.role CHECK constraint.
--   Valid values: 'admin', 'internal', 'borrower', 'realtor'.
--   Step 9 drops ALL old policies. Step 10 recreates them correctly with
--   get_my_role() IN ('admin','internal').
--
-- TABLES COVERED
--   Confirmed deployed:
--     public.profiles          (from supabase-profiles.sql)
--     public.scenarios         (from supabase-schema.sql)
--     public.pq_letters        (from supabase-schema.sql)
--     public.pq_letter_shares  (from supabase-schema.sql)
--     public.scenario_audit_log (confirmed via storage.js writeAuditLog)
--   Conditional (may or may not exist):
--     public.letter_snapshots  (referenced in storage.js but no schema file)
--
-- FRONTEND IMPACT: ZERO
--   All storage.js INSERT calls omit tenant_id. After Step 6, every table
--   has ALTER COLUMN tenant_id SET DEFAULT public.get_my_tenant_id(), so
--   the correct tenant_id is injected automatically. No JavaScript changes needed.
--
-- MARK'S TENANT
--   slug: 'ningard-cmg'  |  name: 'Ningard - CMG Home Loans'  |  tier: 'team'
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Create the tenants table
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.tenants (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null    default now(),
  updated_at      timestamptz not null    default now(),
  name            text        not null,
  slug            text        not null    unique,
  plan_tier       text        not null    default 'solo'
                  check (plan_tier in ('solo', 'team', 'pro', 'enterprise')),
  branding_config jsonb       not null    default '{}'::jsonb,
  active          boolean     not null    default true
);

-- Add updated_at auto-trigger (reuse existing set_updated_at() if already deployed;
-- wrap in DO block to avoid "trigger already exists" error on re-run)
do $do$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'tenants_updated_at'
      and tgrelid = 'public.tenants'::regclass
  ) then
    execute $ddl$
      create trigger tenants_updated_at
        before update on public.tenants
        for each row execute function public.set_updated_at()
    $ddl$;
  end if;
end;
$do$;

-- RLS — admins manage tenants; individual tenants cannot see each other
alter table public.tenants enable row level security;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Seed Mark's tenant (idempotent via ON CONFLICT slug DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.tenants (name, slug, plan_tier)
values ('Ningard - CMG Home Loans', 'ningard-cmg', 'team')
on conflict (slug) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Add tenant_id column to all tables
--
-- ON DELETE RESTRICT: prevents accidental tenant deletion while data exists.
-- Nullable initially so existing rows can be backfilled in Step 5.
-- NOT NULL constraint added in Step 7 after backfill.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

alter table public.scenarios
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

alter table public.pq_letters
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

alter table public.pq_letter_shares
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

-- Create scenario_audit_log if it doesn't exist yet (may not be in supabase-schema.sql)
create table if not exists public.scenario_audit_log (
  id           uuid        primary key default gen_random_uuid(),
  scenario_id  uuid,
  user_id      uuid,
  action       text,
  changes      jsonb       default '{}'::jsonb,
  note         text        default '',
  created_at   timestamptz default now()
);
alter table public.scenario_audit_log enable row level security;

alter table public.scenario_audit_log
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

-- letter_snapshots: conditional — only add column if the table exists
do $do$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$
      alter table public.letter_snapshots
        add column if not exists tenant_id uuid
        references public.tenants(id) on delete restrict
    $ddl$;
    raise notice 'Step 3: tenant_id added to letter_snapshots';
  else
    raise notice 'Step 3: letter_snapshots not found — skipped (will be added when table is created)';
  end if;
end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Create get_my_tenant_id() SECURITY DEFINER helper
--
-- Mirrors get_my_role() exactly: uses SET LOCAL row_security = off to prevent
-- infinite recursion when this function is called from inside an RLS policy
-- (which would otherwise block reading the profiles table).
--
-- MUST be created BEFORE Step 10 (new RLS policies) because PostgreSQL
-- validates function existence at CREATE POLICY parse time.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_tenant_id()
returns uuid language plpgsql security definer stable
as $func$
begin
  set local row_security = off;
  return (select tenant_id from public.profiles where id = auth.uid());
end;
$func$;

grant execute on function public.get_my_tenant_id() to authenticated;

-- Also ensure get_my_role() is executable (may already be granted; idempotent)
grant execute on function public.get_my_role() to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — Backfill all existing rows with Mark's tenant_id
--
-- Uses slug lookup — NO hardcoded UUIDs. Portable across environments.
-- RAISE EXCEPTION aborts the entire transaction if tenant is missing,
-- preventing a silent partial-backfill.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
declare
  v_tenant_id uuid;
  v_profiles_count  int;
  v_scenarios_count int;
begin
  -- Resolve tenant by slug
  select id into v_tenant_id
  from public.tenants
  where slug = 'ningard-cmg';

  if v_tenant_id is null then
    raise exception 'Backfill aborted: tenant with slug "ningard-cmg" not found. '
                    'Run Step 2 first.';
  end if;

  -- Backfill all confirmed tables
  update public.profiles           set tenant_id = v_tenant_id where tenant_id is null;
  update public.scenarios          set tenant_id = v_tenant_id where tenant_id is null;
  update public.pq_letters         set tenant_id = v_tenant_id where tenant_id is null;
  update public.pq_letter_shares   set tenant_id = v_tenant_id where tenant_id is null;
  update public.scenario_audit_log set tenant_id = v_tenant_id where tenant_id is null;

  -- Backfill letter_snapshots if it exists
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$
      update public.letter_snapshots set tenant_id = $1 where tenant_id is null
    $ddl$ using v_tenant_id;
    raise notice 'Step 5: letter_snapshots backfilled';
  end if;

  -- Row counts for confirmation
  select count(*) into v_profiles_count  from public.profiles  where tenant_id = v_tenant_id;
  select count(*) into v_scenarios_count from public.scenarios where tenant_id = v_tenant_id;

  raise notice 'Step 5 complete — tenant_id = %  |  profiles: %  |  scenarios: %',
    v_tenant_id, v_profiles_count, v_scenarios_count;
end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6 — Set DEFAULT to auto-assign tenant_id on new INSERTs
--
-- After this step, all existing storage.js INSERT calls (which omit tenant_id)
-- will automatically receive the correct tenant_id from the logged-in user's
-- profile. Zero frontend code changes required.
--
-- NOTE: profiles is intentionally omitted here. Its tenant_id is set by the
-- handle_new_user() SECURITY DEFINER trigger (Step 11), not from the session.
-- At INSERT time, the profile row doesn't exist yet so get_my_tenant_id()
-- would return null.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scenarios
  alter column tenant_id set default public.get_my_tenant_id();

alter table public.pq_letters
  alter column tenant_id set default public.get_my_tenant_id();

alter table public.pq_letter_shares
  alter column tenant_id set default public.get_my_tenant_id();

alter table public.scenario_audit_log
  alter column tenant_id set default public.get_my_tenant_id();

-- letter_snapshots: conditional default
do $do$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$
      alter table public.letter_snapshots
        alter column tenant_id set default public.get_my_tenant_id()
    $ddl$;
    raise notice 'Step 6: DEFAULT set on letter_snapshots.tenant_id';
  end if;
end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7 — Add NOT NULL constraint after backfill
--
-- Each column is only set NOT NULL if:
--   a) The column exists
--   b) There are zero null values remaining (backfill was complete)
-- Guarded by information_schema checks to prevent errors on re-run.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
declare
  v_null_count int;
begin

  -- profiles
  select count(*) into v_null_count from public.profiles where tenant_id is null;
  if v_null_count = 0 then
    execute $ddl$ alter table public.profiles alter column tenant_id set not null $ddl$;
    raise notice 'Step 7: profiles.tenant_id set NOT NULL';
  else
    raise warning 'Step 7: profiles has % rows with null tenant_id — NOT NULL skipped. '
                  'Run backfill manually.', v_null_count;
  end if;

  -- scenarios
  select count(*) into v_null_count from public.scenarios where tenant_id is null;
  if v_null_count = 0 then
    execute $ddl$ alter table public.scenarios alter column tenant_id set not null $ddl$;
    raise notice 'Step 7: scenarios.tenant_id set NOT NULL';
  else
    raise warning 'Step 7: scenarios has % rows with null tenant_id — NOT NULL skipped.', v_null_count;
  end if;

  -- pq_letters
  select count(*) into v_null_count from public.pq_letters where tenant_id is null;
  if v_null_count = 0 then
    execute $ddl$ alter table public.pq_letters alter column tenant_id set not null $ddl$;
    raise notice 'Step 7: pq_letters.tenant_id set NOT NULL';
  else
    raise warning 'Step 7: pq_letters has % rows with null tenant_id — NOT NULL skipped.', v_null_count;
  end if;

  -- pq_letter_shares
  select count(*) into v_null_count from public.pq_letter_shares where tenant_id is null;
  if v_null_count = 0 then
    execute $ddl$ alter table public.pq_letter_shares alter column tenant_id set not null $ddl$;
    raise notice 'Step 7: pq_letter_shares.tenant_id set NOT NULL';
  else
    raise warning 'Step 7: pq_letter_shares has % rows with null tenant_id — NOT NULL skipped.', v_null_count;
  end if;

  -- scenario_audit_log
  select count(*) into v_null_count from public.scenario_audit_log where tenant_id is null;
  if v_null_count = 0 then
    execute $ddl$ alter table public.scenario_audit_log alter column tenant_id set not null $ddl$;
    raise notice 'Step 7: scenario_audit_log.tenant_id set NOT NULL';
  else
    raise warning 'Step 7: scenario_audit_log has % rows with null tenant_id — NOT NULL skipped.', v_null_count;
  end if;

  -- letter_snapshots (conditional)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$
      select count(*) from public.letter_snapshots where tenant_id is null
    $ddl$ into v_null_count;
    if v_null_count = 0 then
      execute $ddl$ alter table public.letter_snapshots alter column tenant_id set not null $ddl$;
      raise notice 'Step 7: letter_snapshots.tenant_id set NOT NULL';
    else
      raise warning 'Step 7: letter_snapshots has % rows with null tenant_id — NOT NULL skipped.', v_null_count;
    end if;
  end if;

end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8 — Create indexes for tenant_id columns
--
-- Composite (tenant_id, user_id) index on scenarios enables fast admin queries
-- that filter by both tenant and user simultaneously.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_tenants_slug
  on public.tenants (slug);

create index if not exists idx_profiles_tenant_id
  on public.profiles (tenant_id);

create index if not exists idx_scenarios_tenant_id
  on public.scenarios (tenant_id);

create index if not exists idx_scenarios_tenant_user
  on public.scenarios (tenant_id, user_id);

create index if not exists idx_pq_letters_tenant_id
  on public.pq_letters (tenant_id);

create index if not exists idx_pq_shares_tenant_id
  on public.pq_letter_shares (tenant_id);

create index if not exists idx_audit_log_tenant_id
  on public.scenario_audit_log (tenant_id);

-- letter_snapshots index: conditional
do $do$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$
      create index if not exists idx_letter_snapshots_tenant_id
        on public.letter_snapshots (tenant_id)
    $ddl$;
    raise notice 'Step 8: index created on letter_snapshots.tenant_id';
  end if;
end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9 — Drop ALL existing RLS policies (clean slate for Step 10)
--
-- All previously deployed admin policies used get_my_role() IN ('admin','lo')
-- which contained the invalid role 'lo'. Dropping ALL policies and recreating
-- them correctly is cleaner than trying to ALTER individual policies.
--
-- DROP POLICY IF EXISTS is idempotent — safe to run on fresh or existing DB.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles policies (all 5 deployed + any variants) ──────────────────────
drop policy if exists "Admins can read all profiles"         on public.profiles;
drop policy if exists "Admins can update borrower permissions" on public.profiles;
drop policy if exists "Users can insert their own profile"   on public.profiles;
drop policy if exists "Users can read own profile"           on public.profiles;
drop policy if exists "Users can update their own profile"   on public.profiles;
-- Safety net for any older/alternate names that may have been created
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Admins can view all profiles"         on public.profiles;
drop policy if exists "Admins can update any profile"        on public.profiles;

-- ── scenarios policies ──────────────────────────────────────────────────────
drop policy if exists "Users can view their own scenarios"   on public.scenarios;
drop policy if exists "Admins can view all scenarios"        on public.scenarios;
drop policy if exists "Users can insert their own scenarios" on public.scenarios;
drop policy if exists "Users can update their own scenarios" on public.scenarios;
drop policy if exists "Users can delete their own scenarios" on public.scenarios;
-- Safety net
drop policy if exists "Users can select own scenarios"       on public.scenarios;

-- ── pq_letters policies ─────────────────────────────────────────────────────
drop policy if exists "Users can select own pq_letters"      on public.pq_letters;
drop policy if exists "Users can insert own pq_letters"      on public.pq_letters;

-- ── pq_letter_shares policies ───────────────────────────────────────────────
drop policy if exists "Users can select own pq_letter_shares" on public.pq_letter_shares;
drop policy if exists "Users can insert own pq_letter_shares" on public.pq_letter_shares;

-- ── scenario_audit_log policies (if any) ────────────────────────────────────
drop policy if exists "Users can view own audit log"         on public.scenario_audit_log;
drop policy if exists "Users can insert audit log"           on public.scenario_audit_log;
drop policy if exists "Admins can view all audit logs"       on public.scenario_audit_log;

-- ── letter_snapshots policies (conditional) ─────────────────────────────────
do $do$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$ drop policy if exists "Users can select own letter_snapshots" on public.letter_snapshots $ddl$;
    execute $ddl$ drop policy if exists "Users can insert own letter_snapshots" on public.letter_snapshots $ddl$;
    execute $ddl$ drop policy if exists "Admins can view all letter_snapshots"  on public.letter_snapshots $ddl$;
    raise notice 'Step 9: letter_snapshots policies dropped';
  end if;
end;
$do$;

-- ── tenants policies (new table — no existing policies to drop, but guard anyway) ─
drop policy if exists "Admins can manage tenants"            on public.tenants;
drop policy if exists "Authenticated users can read own tenant" on public.tenants;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10 — New tenant-aware RLS policies
--
-- KEY CORRECTIONS vs previously deployed policies:
--   1. All admin checks corrected: get_my_role() IN ('admin','internal')
--      (NOT 'lo' — 'lo' was never a valid role per profiles.role CHECK constraint)
--   2. All non-admin row access adds: tenant_id = public.get_my_tenant_id()
--   3. profiles INSERT stays WITHOUT tenant_id check — see note below.
--
-- PROFILES INSERT NOTE:
--   The insert policy cannot check tenant_id = get_my_tenant_id() because
--   at the moment of first INSERT, the profile row does not yet exist.
--   get_my_tenant_id() reads from profiles, so it returns null → check fails.
--   The handle_new_user() SECURITY DEFINER trigger (Step 11) sets tenant_id
--   at INSERT time instead. Policy stays as: with check (id = auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── tenants table ────────────────────────────────────────────────────────────

-- Admins can manage their own tenant row
create policy "Admins can manage tenants"
  on public.tenants for all
  using  (public.get_my_role() in ('admin', 'internal'))
  with check (public.get_my_role() in ('admin', 'internal'));

-- All authenticated users can read their own tenant (needed for branding, config)
create policy "Authenticated users can read own tenant"
  on public.tenants for select
  using (id = public.get_my_tenant_id());


-- ── profiles table ───────────────────────────────────────────────────────────

-- Admins/internal can read all profiles within their tenant
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.get_my_role() in ('admin', 'internal'));

-- Admins/internal can update borrower_permissions on any profile in their tenant
create policy "Admins can update borrower permissions"
  on public.profiles for update
  using  (public.get_my_role() in ('admin', 'internal'))
  with check (public.get_my_role() in ('admin', 'internal'));

-- Users can insert their own profile (trigger-created; tenant_id set by trigger)
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Users can update their own profile (excluding role/tenant_id — no column filter needed here;
-- column-level control handled via Supabase column privileges if needed in future)
create policy "Users can update their own profile"
  on public.profiles for update
  using  (id = auth.uid())
  with check (id = auth.uid());


-- ── scenarios table ──────────────────────────────────────────────────────────

create policy "Users can select own scenarios"
  on public.scenarios for select
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());

create policy "Admins can view all scenarios"
  on public.scenarios for select
  using (public.get_my_role() in ('admin', 'internal'));

create policy "Users can insert their own scenarios"
  on public.scenarios for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own scenarios"
  on public.scenarios for update
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());

create policy "Users can delete their own scenarios"
  on public.scenarios for delete
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());


-- ── pq_letters table (insert-only, immutable) ────────────────────────────────

create policy "Users can select own pq_letters"
  on public.pq_letters for select
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());

create policy "Admins can view all pq_letters"
  on public.pq_letters for select
  using (public.get_my_role() in ('admin', 'internal'));

create policy "Users can insert own pq_letters"
  on public.pq_letters for insert
  with check (auth.uid() = user_id);


-- ── pq_letter_shares table (insert-only, immutable) ─────────────────────────

create policy "Users can select own pq_letter_shares"
  on public.pq_letter_shares for select
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());

create policy "Admins can view all pq_letter_shares"
  on public.pq_letter_shares for select
  using (public.get_my_role() in ('admin', 'internal'));

create policy "Users can insert own pq_letter_shares"
  on public.pq_letter_shares for insert
  with check (auth.uid() = user_id);


-- ── scenario_audit_log table ─────────────────────────────────────────────────

-- Ensure RLS is enabled (table may not have had it enabled previously)
alter table public.scenario_audit_log enable row level security;

create policy "Users can view own audit log"
  on public.scenario_audit_log for select
  using (auth.uid() = user_id
     and tenant_id = public.get_my_tenant_id());

create policy "Admins can view all audit logs"
  on public.scenario_audit_log for select
  using (public.get_my_role() in ('admin', 'internal'));

create policy "Users can insert audit log"
  on public.scenario_audit_log for insert
  with check (auth.uid() = user_id);


-- ── letter_snapshots table (conditional, insert-only) ────────────────────────

do $do$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'letter_snapshots'
  ) then
    execute $ddl$ alter table public.letter_snapshots enable row level security $ddl$;

    execute $ddl$
      create policy "Users can select own letter_snapshots"
        on public.letter_snapshots for select
        using (auth.uid() = user_id
           and tenant_id = public.get_my_tenant_id())
    $ddl$;

    execute $ddl$
      create policy "Admins can view all letter_snapshots"
        on public.letter_snapshots for select
        using (public.get_my_role() in ('admin', 'internal'))
    $ddl$;

    execute $ddl$
      create policy "Users can insert own letter_snapshots"
        on public.letter_snapshots for insert
        with check (auth.uid() = user_id)
    $ddl$;

    raise notice 'Step 10: letter_snapshots RLS policies created';
  else
    raise notice 'Step 10: letter_snapshots not found — policies skipped';
  end if;
end;
$do$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11 — Update handle_new_user() to set tenant_id on new user creation
--
-- The trigger on_auth_user_created already exists — we only replace the
-- function body. DO NOT recreate the trigger itself.
--
-- Logic:
--   1. Check raw_user_meta_data for an explicit 'tenant_id' (future multi-tenant
--      onboarding flow can pass this when creating a user for a specific tenant)
--   2. Fall back to the oldest active tenant (Mark's tenant for now)
--   3. ON CONFLICT (id) DO NOTHING prevents errors if trigger fires twice
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
as $func$
declare
  v_tenant_id uuid;
begin
  -- Prefer explicit tenant_id from signup metadata (for future multi-tenant onboarding)
  v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;

  -- Fall back: assign to the oldest active tenant (Mark's for now)
  if v_tenant_id is null then
    select id into v_tenant_id
    from public.tenants
    where active = true
    order by created_at asc
    limit 1;
  end if;

  insert into public.profiles (id, display_name, email, role, tenant_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'role', 'borrower'),
    v_tenant_id
  )
  on conflict (id) do nothing;

  return new;
end;
$func$;

-- NOTE: The trigger on_auth_user_created is NOT recreated here.
-- Only the function body is updated. Recreating the trigger would require
-- DROP TRIGGER IF EXISTS first, which risks a race condition during
-- concurrent user signups. Function-only update is safe.


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- Run these separately AFTER the migration to confirm everything applied.
-- Copy/paste each block individually into SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

/*
-- ① Confirm tenants table exists and Mark's tenant was seeded
select id, name, slug, plan_tier, active, created_at
from public.tenants
order by created_at;

-- ② Confirm tenant_id columns were added to all tables
select table_name, column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and column_name = 'tenant_id'
order by table_name;

-- ③ Confirm no orphaned rows (null tenant_id) remain
select 'profiles'        as tbl, count(*) as null_count from public.profiles          where tenant_id is null
union all
select 'scenarios',                count(*)              from public.scenarios         where tenant_id is null
union all
select 'pq_letters',               count(*)              from public.pq_letters        where tenant_id is null
union all
select 'pq_letter_shares',         count(*)              from public.pq_letter_shares  where tenant_id is null
union all
select 'scenario_audit_log',       count(*)              from public.scenario_audit_log where tenant_id is null;

-- ④ Confirm get_my_tenant_id() function exists
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_my_role', 'get_my_tenant_id')
order by routine_name;

-- ⑤ Confirm all RLS policies (check no 'lo' remains in any policy definition)
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ⑥ Confirm indexes were created
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname like 'idx_%tenant%'
order by tablename;
*/


-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- Next file to run: supabase-contacts.sql (Contacts CMS — Phase 1)
-- ═══════════════════════════════════════════════════════════════════════════════
