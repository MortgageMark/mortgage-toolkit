-- supabase-lo-profile-migration.sql
-- Adds LO / partner profile fields to the contacts table.
-- These fields turn any Business-type contact into a rich professional profile:
-- job title, NMLS, display email for PQ letters, company NMLS, branch NMLS,
-- website, team lead assignment (self-ref FK), and branch assignment.
--
-- Safe to run multiple times (IF NOT EXISTS guards every column).

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lo_title           text,
  ADD COLUMN IF NOT EXISTS lo_nmls            text,
  ADD COLUMN IF NOT EXISTS lo_license         text,
  ADD COLUMN IF NOT EXISTS lo_email_display   text,
  ADD COLUMN IF NOT EXISTS lo_company_nmls    text,
  ADD COLUMN IF NOT EXISTS lo_branch_nmls     text,
  ADD COLUMN IF NOT EXISTS lo_website         text,
  ADD COLUMN IF NOT EXISTS team_lead_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN IF NOT EXISTS branch_id          uuid
    REFERENCES public.branches(id) ON DELETE SET NULL;

-- Index for team lead lookups (who is on whose team)
CREATE INDEX IF NOT EXISTS contacts_team_lead_idx
  ON public.contacts (team_lead_contact_id)
  WHERE team_lead_contact_id IS NOT NULL;

-- Index for branch lookups
CREATE INDEX IF NOT EXISTS contacts_branch_idx
  ON public.contacts (branch_id)
  WHERE branch_id IS NOT NULL;

-- No RLS changes needed — existing contacts policies already cover these columns.
