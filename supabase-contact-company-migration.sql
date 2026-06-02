-- Add company field to contacts
-- Run once in Supabase SQL editor

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS company text;
