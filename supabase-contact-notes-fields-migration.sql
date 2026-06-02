-- supabase-contact-notes-fields-migration.sql
-- Adds follow-up fields and a quick-note field to the contacts table.
-- Safe to run multiple times (IF NOT EXISTS).

-- Follow-up scheduling
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS fu_date     DATE;          -- next follow-up date
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS fu_who      TEXT;          -- 'MP' | 'JW' | 'TP' (team member)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS fu_priority TEXT;          -- '' | 'Low' | 'High'

-- Quick note (120-char call reminder, separate from permanent notes)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS note_quick  TEXT;
