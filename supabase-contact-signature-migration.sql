-- Add signature_url column to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS signature_url TEXT;
