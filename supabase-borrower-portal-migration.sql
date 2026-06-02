-- supabase-borrower-portal-migration.sql
-- Enables LO-created portal accounts for borrowers
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- 1. Link a contact record to their Supabase Auth account
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_auth_user_id
  ON public.contacts (auth_user_id);

-- 2. Flag LO-created accounts that require a password change on first login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
