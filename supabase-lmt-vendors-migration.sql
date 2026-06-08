-- Add vendor contact fields to lmt_deals
ALTER TABLE public.lmt_deals
  ADD COLUMN IF NOT EXISTS title_company       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_company_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_company_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS appraiser           text DEFAULT '',
  ADD COLUMN IF NOT EXISTS appraiser_email     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS appraiser_phone     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hoi_company         text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hoi_company_email   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hoi_company_phone   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS flood_company       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS flood_company_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS escrow_company      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS escrow_company_email text DEFAULT '';
