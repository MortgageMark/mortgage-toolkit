-- LMT Profile: add branch, team_loas, team_processors
-- Run in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch           text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS team_loas        jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS team_processors  jsonb   DEFAULT '[]';
