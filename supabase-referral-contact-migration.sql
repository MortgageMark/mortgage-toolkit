-- supabase-referral-contact-migration.sql
-- Session 11: Add referred_by_contact_id (self-referential FK on contacts)
--
-- Run in Supabase SQL Editor AFTER supabase-contact-categories-migration.sql
-- (or run both in the same session — order doesn't matter between them)
--
-- What this does:
--   1. Adds referred_by_contact_id (nullable uuid FK → contacts.id)
--   2. Adds an index for FK lookups

-- ── 1. Add column ────────────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS referred_by_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

-- ── 2. Add index ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS contacts_referred_by_idx
  ON public.contacts (referred_by_contact_id)
  WHERE referred_by_contact_id IS NOT NULL;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT id, first_name, last_name, referred_by_contact_id
-- FROM public.contacts
-- LIMIT 10;
