-- Add creator_id to contacts table
-- Tracks which internal user (LO/admin) is responsible for the record,
-- regardless of who was logged in when it was inserted.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contacts_creator_id_idx ON public.contacts (creator_id);
