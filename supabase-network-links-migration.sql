-- supabase-network-links-migration.sql
-- Adds network_links JSONB column to contacts for Transaction Team tab
-- Each entry: { role: "realtor", contact_id: "uuid" }

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS network_links JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contacts.network_links IS
  'Array of {role, contact_id} objects linking vendor/partner contacts to this contact. Roles: builder, realtor, lender, insurance, title';
