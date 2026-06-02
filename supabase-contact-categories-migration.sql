-- supabase-contact-categories-migration.sql
-- Session 11: Replace flat contact_type with two-level Business/Client system
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Deploy BEFORE refreshing the app.
--
-- What this does:
--   1. Drops the old contact_type CHECK constraint
--   2. Adds a new contact_category TEXT column
--   3. Migrates all existing rows to the new two-level system
--   4. Adds a new CHECK constraint (business | client only)

-- ── 1. Drop old CHECK constraint ────────────────────────────────────────────
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

-- ── 2. Add contact_category column ──────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_category TEXT;

-- ── 3. Migrate existing rows ─────────────────────────────────────────────────
-- Old type → new contact_type + contact_category
UPDATE public.contacts
SET
  contact_category = CASE contact_type
    WHEN 'lead'     THEN 'Client'
    WHEN 'borrower' THEN 'Client'
    WHEN 'realtor'  THEN 'Realtor'
    WHEN 'builder'  THEN 'Home Builder'
    WHEN 'other'    THEN 'Other'
    ELSE 'Other'
  END,
  contact_type = CASE contact_type
    WHEN 'lead'     THEN 'client'
    WHEN 'borrower' THEN 'client'
    WHEN 'realtor'  THEN 'business'
    WHEN 'builder'  THEN 'business'
    WHEN 'other'    THEN 'business'
    ELSE 'business'
  END
WHERE contact_type IN ('lead', 'borrower', 'realtor', 'builder', 'other');

-- ── 4. Add new CHECK constraint ──────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('business', 'client'));

-- ── 5. Add index for category filtering ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS contacts_contact_category_idx
  ON public.contacts (contact_category);

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Run this to confirm migration:
-- SELECT contact_type, contact_category, count(*)
-- FROM public.contacts
-- GROUP BY contact_type, contact_category
-- ORDER BY contact_type, contact_category;
