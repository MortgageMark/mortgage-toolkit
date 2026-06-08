-- Add branch_admin to the profiles role check constraint
-- Run in Supabase SQL Editor

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin','internal','branch_admin','borrower','realtor','builder'));
