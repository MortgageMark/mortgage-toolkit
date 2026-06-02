-- ═══════════════════════════════════════════════════════════════════════
-- Home Loan Toolkit — Profiles Table
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (Run AFTER the first schema file)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Profiles table — stores display name, role, and LO details
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  display_name text not null default '',
  role        text not null default 'borrower'
              check (role in ('admin', 'internal', 'borrower', 'realtor')),
  title       text default '',
  company     text default '',
  phone       text default '',
  email       text default '',
  nmls        text default '',
  branch_nmls text default '',
  address     text default '',
  city        text default '',
  state       text default '',
  zip         text default ''
);

-- 2. Index for quick role lookups
create index if not exists idx_profiles_role on public.profiles(role);

-- 3. Row-Level Security
alter table public.profiles enable row level security;

-- Everyone can read profiles (needed for scenario dashboards, admin panel, etc.)
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can insert their own profile (on first sign-up)
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 4. Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'role', 'borrower')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop the trigger first if it exists (safe re-run)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Reuse the updated_at trigger
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
