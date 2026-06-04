-- supabase-scoped-visibility-migration.sql
-- Complete data visibility rules for contacts and scenarios.
--
-- Who sees what:
--   Admin (admin/super_admin/branch_admin) → everything in tenant
--   LO (internal) → own data + team members + linked partners + assigned contacts
--   Builder/Realtor → own data only (plus explicitly shared scenarios)
--   Borrower → own contact record + own scenarios
--
-- "Linked partner" = Builder or Realtor whose contact record has assigned_lo_id = this LO


-- ── 1. Helper: get partner user IDs (Builders/Realtors linked to this LO) ──────
-- Returns profile IDs of Builder/Realtor users whose contact record
-- has assigned_lo_id = the current user's ID.

CREATE OR REPLACE FUNCTION public.get_my_partner_user_ids()
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER VOLATILE AS $$
DECLARE
  result uuid[];
BEGIN
  SET LOCAL row_security = off;
  SELECT array_agg(DISTINCT p.id)
    INTO result
    FROM public.profiles p
    INNER JOIN public.contacts c ON c.created_by_user_id = p.id
    WHERE c.assigned_lo_id = auth.uid()
      AND p.role IN ('builder', 'realtor')
      AND c.tenant_id = public.get_my_tenant_id();
  RETURN COALESCE(result, ARRAY[]::uuid[]);
END;
$$;


-- ── 2. Ensure get_my_team_user_ids is VOLATILE (required for SET LOCAL) ─────────
CREATE OR REPLACE FUNCTION public.get_my_team_user_ids()
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER VOLATILE AS $$
DECLARE
  my_id uuid := auth.uid();
  my_team_lead_id uuid;
  result uuid[];
BEGIN
  SET LOCAL row_security = off;
  result := ARRAY[my_id];
  SELECT team_lead_id INTO my_team_lead_id FROM public.profiles WHERE id = my_id;
  IF my_team_lead_id IS NOT NULL THEN
    SELECT result || array_agg(id) INTO result
      FROM public.profiles WHERE team_lead_id = my_team_lead_id AND id != my_id;
    result := result || ARRAY[my_team_lead_id];
  END IF;
  SELECT result || array_agg(id) INTO result
    FROM public.profiles WHERE team_lead_id = my_id;
  SELECT array_agg(DISTINCT u) INTO result FROM unnest(result) u WHERE u IS NOT NULL;
  RETURN COALESCE(result, ARRAY[my_id]);
END;
$$;


-- ── 3. CONTACTS policies ─────────────────────────────────────────────────────────

-- Drop all existing SELECT policies on contacts
DROP POLICY IF EXISTS "Internal users can view all contacts"          ON public.contacts;
DROP POLICY IF EXISTS "Internal users can read all contacts"          ON public.contacts;
DROP POLICY IF EXISTS "Admins can read all contacts"                  ON public.contacts;
DROP POLICY IF EXISTS "Admins see all contacts"                       ON public.contacts;
DROP POLICY IF EXISTS "Users see own and team contacts"               ON public.contacts;
DROP POLICY IF EXISTS "Borrowers can view own contact record"         ON public.contacts;
DROP POLICY IF EXISTS "internal_read_all"                             ON public.contacts;

-- Policy A: Admins see all contacts in their tenant
CREATE POLICY "Admins see all contacts"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'super_admin', 'branch_admin')
  );

-- Policy B: Internal users (LOs) see:
--   1. Contacts they created
--   2. Contacts their team members created
--   3. Contacts created by linked partners (Builders/Realtors assigned to them)
--   4. Contacts where they are the assigned LO
CREATE POLICY "LOs see their scoped contacts"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'internal'
    AND (
      created_by_user_id = ANY(public.get_my_team_user_ids())
      OR assigned_lo_id = auth.uid()
      OR created_by_user_id = ANY(public.get_my_partner_user_ids())
    )
  );

-- Policy C: Builders and Realtors see contacts they created
CREATE POLICY "Partners see own contacts"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('builder', 'realtor')
    AND created_by_user_id = auth.uid()
  );

-- Policy D: Borrowers see only their own contact record
CREATE POLICY "Borrowers see own contact record"
  ON public.contacts FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'borrower'
    AND (
      lower(email_work)     = lower(auth.jwt() ->> 'email')
      OR lower(email_personal) = lower(auth.jwt() ->> 'email')
      OR lower(email)          = lower(auth.jwt() ->> 'email')
    )
  );


-- ── 4. SCENARIOS policies ────────────────────────────────────────────────────────

-- Drop all existing SELECT policies on scenarios
DROP POLICY IF EXISTS "Internal users can read all scenarios"         ON public.scenarios;
DROP POLICY IF EXISTS "Admins see all scenarios"                      ON public.scenarios;
DROP POLICY IF EXISTS "Users see own and team scenarios"              ON public.scenarios;
DROP POLICY IF EXISTS "internal_read_all"                             ON public.scenarios;
DROP POLICY IF EXISTS "Borrowers can read own scenarios"              ON public.scenarios;
DROP POLICY IF EXISTS "Borrowers can claim unclaimed scenarios"       ON public.scenarios;
DROP POLICY IF EXISTS "Partners can view referred scenarios"          ON public.scenarios;

-- Policy A: Admins see all scenarios in their tenant
CREATE POLICY "Admins see all scenarios"
  ON public.scenarios FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'super_admin', 'branch_admin')
  );

-- Policy B: LOs see:
--   1. Scenarios they created (user_id = me or team member)
--   2. Scenarios created by linked partners
--   3. Scenarios where the linked contact is assigned to them
--   4. Explicitly shared scenarios (via scenario_shares)
CREATE POLICY "LOs see their scoped scenarios"
  ON public.scenarios FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'internal'
    AND (
      user_id = ANY(public.get_my_team_user_ids())
      OR user_id = ANY(public.get_my_partner_user_ids())
      OR contact_id IN (
        SELECT id FROM public.contacts
        WHERE assigned_lo_id = auth.uid()
          AND tenant_id = public.get_my_tenant_id()
      )
      OR id IN (
        SELECT scenario_id FROM public.scenario_shares
        WHERE shared_with_user_id = auth.uid()
      )
    )
  );

-- Policy C: Builders and Realtors see their own scenarios + explicitly shared
CREATE POLICY "Partners see own scenarios"
  ON public.scenarios FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('builder', 'realtor')
    AND (
      user_id = auth.uid()
      OR id IN (
        SELECT scenario_id FROM public.scenario_shares
        WHERE shared_with_user_id = auth.uid()
      )
    )
  );

-- Policy D: Borrowers see their own scenarios (by user_id or email match via contact)
CREATE POLICY "Borrowers see own scenarios"
  ON public.scenarios FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'borrower'
    AND (
      user_id = auth.uid()
      OR contact_id IN (
        SELECT id FROM public.contacts
        WHERE (
          lower(email_work)     = lower(auth.jwt() ->> 'email')
          OR lower(email_personal) = lower(auth.jwt() ->> 'email')
          OR lower(email)          = lower(auth.jwt() ->> 'email')
        )
        AND tenant_id = public.get_my_tenant_id()
      )
    )
  );

-- Borrower UPDATE (for claiming scenarios) — keep existing
DROP POLICY IF EXISTS "Borrowers can update own scenarios"            ON public.scenarios;
CREATE POLICY "Borrowers can update own scenarios"
  ON public.scenarios FOR UPDATE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND (
      user_id = auth.uid()
      OR contact_id IN (
        SELECT id FROM public.contacts
        WHERE lower(COALESCE(email_work, email_personal, email, '')) = lower(auth.jwt() ->> 'email')
          AND tenant_id = public.get_my_tenant_id()
      )
    )
  );
