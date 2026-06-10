-- supabase-lead-status-blank-default.sql
-- Changes the lead_status column default from '?' to ''
-- and cleans up any existing rows that have '?' as a value.
-- Run in Supabase SQL Editor.

-- 1. Change the column default
ALTER TABLE public.scenarios
  ALTER COLUMN lead_status SET DEFAULT '';

-- 2. Blank out any rows currently storing '?'
UPDATE public.scenarios
  SET lead_status = ''
  WHERE lead_status = '?';
