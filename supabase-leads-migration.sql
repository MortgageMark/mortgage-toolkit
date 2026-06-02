-- supabase-leads-migration.sql
-- Adds lead pipeline fields to the scenarios table.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS guards).
-- Run after supabase-contacts.sql has been deployed.

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS lead_status        text    DEFAULT '?',
  ADD COLUMN IF NOT EXISTS loan_purpose       text    DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS property_address   text,
  ADD COLUMN IF NOT EXISTS lead_source        text,
  ADD COLUMN IF NOT EXISTS target_close_date  date,
  ADD COLUMN IF NOT EXISTS actual_close_date  date;

-- Index for fast tab filtering (getLeadGroup uses startsWith logic at app layer,
-- but this helps ORDER BY and WHERE lead_status = X queries in Supabase Studio).
CREATE INDEX IF NOT EXISTS scenarios_lead_status_idx
  ON public.scenarios (lead_status);

-- Back-fill any NULLs that may exist for rows created before this migration.
UPDATE public.scenarios SET lead_status  = '?'        WHERE lead_status  IS NULL;
UPDATE public.scenarios SET loan_purpose = 'purchase' WHERE loan_purpose IS NULL;
