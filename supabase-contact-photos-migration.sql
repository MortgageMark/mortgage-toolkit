-- Add photo_url and logo_url to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS logo_url  TEXT;

-- ── Supabase Storage bucket setup (run in dashboard or via CLI) ──────────────
-- 1. Go to Supabase Dashboard → Storage → New Bucket
-- 2. Name: contact-photos
-- 3. Check "Public bucket" so URLs are publicly readable
-- 4. Add the following RLS policy to the bucket:

-- Allow authenticated internal users to upload/delete
-- (Paste this in Storage → Policies → contact-photos)
--
-- INSERT policy (internal team can upload):
-- ((storage.foldername(name))[1] IS NOT NULL AND auth.role() = 'authenticated')
--
-- SELECT policy (anyone can read public URLs — bucket is public so this is automatic)
--
-- DELETE policy (internal team can delete):
-- (auth.role() = 'authenticated')
