-- supabase-partner-notes-migration.sql
-- Allows Realtors and Builders to read and add notes on contacts they created.

-- SELECT: internal team (existing) OR partner who created the parent contact
DROP POLICY IF EXISTS "Internal team can view notes" ON public.contact_notes;
CREATE POLICY "Internal team can view notes"
  ON public.contact_notes FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND c.created_by_user_id = auth.uid()
    )
  );

-- INSERT: internal team (existing) OR partner who created the parent contact
DROP POLICY IF EXISTS "Internal team can add notes" ON public.contact_notes;
CREATE POLICY "Internal team can add notes"
  ON public.contact_notes FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'internal')
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND c.created_by_user_id = auth.uid()
    )
  );
