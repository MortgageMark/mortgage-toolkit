-- LMT Permissions: add lmt_role to profiles
-- Run in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lmt_role text DEFAULT 'lo'
    CHECK (lmt_role IN ('lo','loa','processor','setup'));
