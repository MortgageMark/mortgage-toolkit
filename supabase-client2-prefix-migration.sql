-- supabase-client2-prefix-migration.sql
-- Adds prefix (Mr./Mrs.) for Client 1, and all Client 2 co-borrower fields.
-- Safe to run multiple times (IF NOT EXISTS).

-- Client 1 prefix
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS prefix TEXT; -- 'Mr.' | 'Mrs.' | 'Dr.' | 'Rev.' | 'Prof.'

-- Client 2 co-borrower fields — name + relationship
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS prefix2               TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_name2           TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS nickname2             TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_name2            TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS connection_to_contact1 TEXT; -- 'Spouse' | 'Significant Other' | 'Parent' | 'Child' | 'Other'

-- Client 2 phone fields
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone2      TEXT; -- cell / primary
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone2_work TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone2_home TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone2_best TEXT; -- 'Cell' | 'Work' | 'Home'

-- Client 2 email fields
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email2       TEXT; -- personal / primary
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email2_work  TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email2_other TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email2_best  TEXT; -- 'Personal' | 'Work' | 'Other'
