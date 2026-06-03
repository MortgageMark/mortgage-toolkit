-- supabase-team-logo-migration.sql
-- Adds team_logo_url column to contacts for LO personal brand logo on PQ letter

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS team_logo_url TEXT;

COMMENT ON COLUMN public.contacts.team_logo_url IS
  'LO personal/team brand logo (upper-right of PQ letter). Different from logo_url which is the company logo.';
