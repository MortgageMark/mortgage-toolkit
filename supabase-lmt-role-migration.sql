-- Add lmt_role column to profiles table
-- Sub-role for internal/branch_admin users: lo, loa, processor, manager

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lmt_role text DEFAULT 'lo';

-- Back-fill existing internal users to 'lo' if null
UPDATE public.profiles
  SET lmt_role = 'lo'
  WHERE lmt_role IS NULL
    AND role IN ('internal', 'branch_admin', 'admin', 'super_admin');
