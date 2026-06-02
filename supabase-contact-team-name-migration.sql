-- Add team_name column to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS team_name TEXT;
