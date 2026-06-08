-- supabase-branch-manager-migration.sql
-- Adds is_branch_manager designation to profiles.
-- Branch managers can manage their team: add members, access control, templates.
-- This is a designation (boolean flag), not a separate role.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_branch_manager boolean NOT NULL DEFAULT false;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS profiles_branch_manager_idx
  ON public.profiles (is_branch_manager)
  WHERE is_branch_manager = true;

-- RLS: users can read is_branch_manager on their own profile and teammates
-- No additional RLS policies needed — existing profile SELECT policies cover this.
-- Only admins can write is_branch_manager (enforced in application layer via viewerRole check).
