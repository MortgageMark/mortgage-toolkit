-- ═══════════════════════════════════════════════════════════════════════
-- Home Loan Toolkit — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Scenarios table
create table if not exists public.scenarios (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Untitled Scenario',
  status      text not null default 'active' check (status in ('active', 'archived', 'closed')),
  notes       text default '',
  calculation_data jsonb not null default '{}'::jsonb
);

-- 2. Index for fast lookups by user
create index if not exists idx_scenarios_user_id on public.scenarios(user_id);

-- 3. Row-Level Security — each user can only access their own rows
alter table public.scenarios enable row level security;

create policy "Users can view their own scenarios"
  on public.scenarios for select
  using (auth.uid() = user_id);

-- Admins can view ALL scenarios
create policy "Admins can view all scenarios"
  on public.scenarios for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Users can insert their own scenarios"
  on public.scenarios for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own scenarios"
  on public.scenarios for update
  using (auth.uid() = user_id);

create policy "Users can delete their own scenarios"
  on public.scenarios for delete
  using (auth.uid() = user_id);

-- 4. Auto-update the updated_at timestamp on every update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger scenarios_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- pq_letters table — immutable PQ Letter snapshots (insert-only)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.pq_letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  letter_id   text not null,
  created_at  timestamptz not null default now(),
  snapshot    jsonb not null
);

create index if not exists idx_pq_letters_scenario_id on public.pq_letters(scenario_id);
create index if not exists idx_pq_letters_user_id     on public.pq_letters(user_id);

alter table public.pq_letters enable row level security;

-- Users can read their own letters
create policy "Users can select own pq_letters"
  on public.pq_letters for select
  using (auth.uid() = user_id);

-- Users can insert their own letters (no update/delete — immutable)
create policy "Users can insert own pq_letters"
  on public.pq_letters for insert
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- pq_letter_shares table — immutable share/email log (insert-only)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.pq_letter_shares (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  letter_id     text not null,
  scenario_id   text not null,
  sent_at       timestamptz not null default now(),
  realtor_name  text not null,
  realtor_email text not null,
  note          text not null default ''
);

create index if not exists idx_pq_letter_shares_scenario_id on public.pq_letter_shares(scenario_id);
create index if not exists idx_pq_letter_shares_user_id     on public.pq_letter_shares(user_id);

alter table public.pq_letter_shares enable row level security;

-- Users can read their own share log entries
create policy "Users can select own pq_letter_shares"
  on public.pq_letter_shares for select
  using (auth.uid() = user_id);

-- Users can insert their own share log entries (no update/delete — immutable log)
create policy "Users can insert own pq_letter_shares"
  on public.pq_letter_shares for insert
  with check (auth.uid() = user_id);
