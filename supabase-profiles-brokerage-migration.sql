-- Add brokerage field to profiles (for realtor team grouping)
-- Run once in Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brokerage text;
