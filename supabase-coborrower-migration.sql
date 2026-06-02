-- supabase-coborrower-migration.sql
-- Adds co_borrower_data jsonb column to contacts table so clients can save
-- a co-borrower / spouse's info from the "My Information" panel.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS co_borrower_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.contacts.co_borrower_data IS
  'Optional co-borrower / spouse info stored by the client from the My Info panel.
   Shape: { firstName, lastName, phone (digits only), email, relation }';
