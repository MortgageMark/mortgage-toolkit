-- supabase-builder-role-migration.sql
-- Adds 'builder' as a valid role in the profiles table CHECK constraint.
-- Run this in the Supabase SQL Editor.

-- Step 1: See what role values currently exist (for reference)
-- SELECT role, count(*) FROM public.profiles GROUP BY role;

-- Step 2: Fix any rows with invalid role values before adding the constraint.
-- 'lo' was an old value used before the 'internal' fix — remap it.
UPDATE public.profiles SET role = 'internal' WHERE role = 'lo';
-- Any other unexpected values fall back to 'borrower'
UPDATE public.profiles SET role = 'borrower'
  WHERE role NOT IN ('admin', 'internal', 'borrower', 'realtor', 'builder');

-- Step 3: Drop the existing CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Step 4: Re-add it with 'builder' included
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'internal', 'borrower', 'realtor', 'builder'));

-- Done. Verify with:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
