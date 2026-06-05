-- supabase-fu-who-migration.sql
-- Adds fu_who_options to profiles so FU Who dropdown syncs across devices.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fu_who_options TEXT DEFAULT '';
