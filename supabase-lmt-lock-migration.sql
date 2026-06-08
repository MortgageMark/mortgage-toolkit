-- Add lock tracking fields to lmt_deals
ALTER TABLE public.lmt_deals
  ADD COLUMN IF NOT EXISTS lock_start_date date,
  ADD COLUMN IF NOT EXISTS lock_term_days  integer;
