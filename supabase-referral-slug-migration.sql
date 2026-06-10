-- Add referral_slug column to profiles
-- Allows LOs to have a custom vanity URL: homeloantoolkit.com/TeamMazz

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_slug text;

-- Enforce uniqueness (case-insensitive via a unique index on lower())
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_slug_unique
  ON public.profiles (lower(referral_slug))
  WHERE referral_slug IS NOT NULL;

-- Verify
SELECT id, display_name, referral_slug FROM public.profiles WHERE referral_slug IS NOT NULL;
