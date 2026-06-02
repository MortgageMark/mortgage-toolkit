-- supabase-profiles-email-display.sql
-- Adds email_display to profiles — the email shown on Pre-Qual Letters,
-- Fee Sheets, and all client-facing LO contact info.
-- profiles.email remains the Supabase Auth login ID (read-only from frontend).
-- Run once in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_display text DEFAULT NULL;

-- Seed existing rows: if email_display is empty, default to the login email
-- so nothing looks blank until each LO explicitly sets a display email.
UPDATE public.profiles
   SET email_display = email
 WHERE email_display IS NULL
   AND email IS NOT NULL;
