-- supabase-profiles-extended.sql
-- Adds full LO/team-member contact detail columns to the profiles table
-- so that data entered in AdminPanel is stored in Supabase and is globally
-- available on any device.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title        text,
  ADD COLUMN IF NOT EXISTS phone        text,      -- office / main phone
  ADD COLUMN IF NOT EXISTS cell_phone   text,      -- cell / mobile
  ADD COLUMN IF NOT EXISTS fax          text,
  ADD COLUMN IF NOT EXISTS company      text,
  ADD COLUMN IF NOT EXISTS company_nmls text,
  ADD COLUMN IF NOT EXISTS branch_nmls  text,
  ADD COLUMN IF NOT EXISTS nmls         text,      -- personal NMLS
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS state        text,
  ADD COLUMN IF NOT EXISTS zip          text;

-- Existing RLS policies already cover these columns:
--   "Admins can update borrower permissions"  → UPDATE for admin/internal (covers all columns)
--   "Users can update their own profile"      → UPDATE own row (covers all columns)
-- No new policies needed.
