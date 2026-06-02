-- supabase-borrower-contact-update.sql
-- Allows borrowers/realtors to UPDATE their own contact record (matched by email).
-- Required for the "My Info" panel in the client-facing view.
-- Deploy in Supabase SQL Editor before using the My Info feature.

-- Allow borrowers (and realtors) to update their own contact row
CREATE POLICY "Borrowers can update own contact"
ON public.contacts
FOR UPDATE
USING   (lower(email) = lower(auth.jwt() ->> 'email'))
WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
