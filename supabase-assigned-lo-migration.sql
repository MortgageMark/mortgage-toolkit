-- Add assigned_lo_id column to contacts table
-- Links a contact to their assigned Loan Officer (references auth.users via profiles)

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS assigned_lo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups by assigned LO
CREATE INDEX IF NOT EXISTS contacts_assigned_lo_id_idx ON public.contacts (assigned_lo_id);
