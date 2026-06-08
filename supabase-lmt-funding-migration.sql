ALTER TABLE public.lmt_deals
  ADD COLUMN IF NOT EXISTS funding_date date;
