-- supabase-contacts-extended.sql
-- Adds extended contact columns used by ClientMyInfoPanel (My Information screen)
-- and the co-borrower section.  Supersedes supabase-coborrower-migration.sql —
-- if you already ran that file, co_borrower_data will simply be a no-op here.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.contacts
  -- Multiple phone fields
  ADD COLUMN IF NOT EXISTS phone_cell      text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_home      text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_work      text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_best      text        DEFAULT 'cell',   -- 'cell'|'home'|'work'

  -- Multiple email fields
  ADD COLUMN IF NOT EXISTS email_personal  text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_work      text        DEFAULT '',

  -- Named address fields (keeps old address/city/state/zip for back-compat)
  ADD COLUMN IF NOT EXISTS address1_street text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS address1_city   text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS address1_state  text        DEFAULT '',
  ADD COLUMN IF NOT EXISTS address1_zip    text        DEFAULT '',

  -- Co-borrower / spouse (stored as a single jsonb blob)
  -- Shape: { firstName, lastName, phone (digits only), email, relation }
  ADD COLUMN IF NOT EXISTS co_borrower_data jsonb      DEFAULT NULL;

-- Existing RLS policies already cover these columns:
--   "Internal can do full CRUD"   → covers all new columns for the team
--   "Users can update own profile" (contacts) → covers borrower self-edits
-- No new policies needed.
