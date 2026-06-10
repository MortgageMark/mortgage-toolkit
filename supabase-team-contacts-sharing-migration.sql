-- supabase-team-contacts-sharing-migration.sql
-- Adds per-LO opt-in sharing of contacts with their LOA/Processor team members.
-- Default: OFF (private). LOs opt in via Access Control toggle in UsersPanel.

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_share_contacts boolean NOT NULL DEFAULT false;

-- ── 2. Helper: does the current user's team lead share contacts? ───────────────
-- Returns true if the current user has a team lead AND that lead has
-- team_share_contacts = true. Also returns own value if user is a standalone LO.
CREATE OR REPLACE FUNCTION public.my_team_shares_contacts()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_team_lead_id    uuid;
    v_share_contacts  boolean;
BEGIN
    SELECT team_lead_id
      INTO v_team_lead_id
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_team_lead_id IS NOT NULL THEN
        SELECT COALESCE(team_share_contacts, false)
          INTO v_share_contacts
          FROM public.profiles
         WHERE id = v_team_lead_id;
    ELSE
        SELECT COALESCE(team_share_contacts, false)
          INTO v_share_contacts
          FROM public.profiles
         WHERE id = auth.uid();
    END IF;

    RETURN COALESCE(v_share_contacts, false);
END;
$$;

-- ── 3. Update contacts SELECT policy for internal users ───────────────────────
-- Extend "LOs see their scoped contacts" to also allow LOA/Processors to see
-- their team lead's assigned contacts when team_share_contacts = true.
-- (contacts created by team members are already covered via get_my_team_user_ids)

DROP POLICY IF EXISTS "LOs see their scoped contacts" ON public.contacts;

CREATE POLICY "LOs see their scoped contacts"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'internal'
    AND (
      -- Own contacts and team members' contacts (includes team lead)
      created_by_user_id = ANY(public.get_my_team_user_ids())
      -- Contacts assigned directly to me
      OR assigned_lo_id = auth.uid()
      -- Linked partner contacts (Builders/Realtors assigned to me)
      OR created_by_user_id = ANY(public.get_my_partner_user_ids())
      -- Team lead's assigned contacts when sharing is enabled
      OR (
        public.my_team_shares_contacts()
        AND assigned_lo_id = (
          SELECT team_lead_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
-- SELECT id, display_name, role, team_share_contacts
--   FROM public.profiles
--   WHERE role IN ('internal', 'branch_admin', 'admin')
--   ORDER BY display_name;
