-- Session 12: Expand contacts table with nickname, multiple phone/email, and dual mailing addresses

-- ── Nickname ─────────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS nickname TEXT;

-- ── Phone fields ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_cell TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_work TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_home TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_best TEXT; -- 'Cell' | 'Work' | 'Home'

-- Migrate existing phone → phone_cell
UPDATE public.contacts
SET phone_cell = phone
WHERE phone IS NOT NULL AND phone <> '' AND phone_cell IS NULL;

-- ── Email fields ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_personal TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_work     TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_other    TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_best     TEXT; -- 'Personal' | 'Work' | 'Other'

-- Migrate existing email → email_personal
UPDATE public.contacts
SET email_personal = email
WHERE email IS NOT NULL AND email <> '' AND email_personal IS NULL;

-- ── Address 1 fields ─────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address1_street TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address1_city   TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address1_zip    TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address1_state  TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address1_type   TEXT DEFAULT 'Home'; -- 'Home' | 'Work'

-- Migrate existing address/city/zip/state → address1
UPDATE public.contacts
SET
  address1_street = address,
  address1_city   = city,
  address1_zip    = zip,
  address1_state  = state
WHERE (address IS NOT NULL OR city IS NOT NULL) AND address1_street IS NULL;

-- ── Address 2 fields ─────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address2_street TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address2_city   TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address2_zip    TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address2_state  TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address2_type   TEXT DEFAULT 'Home'; -- 'Home' | 'Work'
