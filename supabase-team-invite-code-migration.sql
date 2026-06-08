-- Team Invite Code Migration
-- Adds a unique shareable code to each profile so LOAs can join an LO's team
-- Run in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_invite_code text UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_team_invite_code_idx
  ON public.profiles (team_invite_code)
  WHERE team_invite_code IS NOT NULL;
