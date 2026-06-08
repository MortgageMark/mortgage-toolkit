-- Add ICD-specific fields to lmt_milestones
ALTER TABLE public.lmt_milestones
  ADD COLUMN IF NOT EXISTS icd_requested_date date,
  ADD COLUMN IF NOT EXISTS icd_sent_date      date,
  ADD COLUMN IF NOT EXISTS icd_signed_date    date;
