-- Data Visibility RLS Migration
-- Restricts scenarios and contacts to owner + team members only.
-- Admins (admin, super_admin, branch_admin) continue to see everything.
-- Internal (LO), Realtor, Builder see only their own data + team members.

-- ── Helper: get team user IDs for current user ───────────────────────────────
-- Returns all user IDs the current user can see data from:
-- themselves + teammates (same team_lead_id) + their direct reports
CREATE OR REPLACE FUNCTION public.get_my_team_user_ids()
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  my_id uuid := auth.uid();
  my_team_lead_id uuid;
  result uuid[];
BEGIN
  SET LOCAL row_security = off;
  -- Start with self
  result := ARRAY[my_id];
  -- Get own team_lead_id
  SELECT team_lead_id INTO my_team_lead_id FROM public.profiles WHERE id = my_id;
  -- Add teammates (same team lead)
  IF my_team_lead_id IS NOT NULL THEN
    SELECT result || array_agg(id) INTO result
      FROM public.profiles WHERE team_lead_id = my_team_lead_id AND id != my_id;
    result := result || ARRAY[my_team_lead_id];
  END IF;
  -- Add direct reports (people whose team_lead is me)
  SELECT result || array_agg(id) INTO result
    FROM public.profiles WHERE team_lead_id = my_id;
  -- Remove nulls and deduplicate
  SELECT array_agg(DISTINCT u) INTO result FROM unnest(result) u WHERE u IS NOT NULL;
  RETURN result;
END;
$$;

-- ── Scenarios: drop old broad internal policy, add scoped ones ───────────────
-- Drop existing overly-broad SELECT policies for internal users
DROP POLICY IF EXISTS "Internal users can read all scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "internal_read_all" ON public.scenarios;

-- New policy: admins see all
CREATE POLICY "Admins see all scenarios"
  ON public.scenarios FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin', 'branch_admin'));

-- New policy: everyone else sees own + team
CREATE POLICY "Users see own and team scenarios"
  ON public.scenarios FOR SELECT
  USING (user_id = ANY(get_my_team_user_ids()));

-- ── Contacts: drop old broad internal policy, add scoped ones ────────────────
DROP POLICY IF EXISTS "Internal users can read all contacts" ON public.contacts;
DROP POLICY IF EXISTS "internal_read_all" ON public.contacts;
DROP POLICY IF EXISTS "Admins can read all contacts" ON public.contacts;

-- New policy: admins see all
CREATE POLICY "Admins see all contacts"
  ON public.contacts FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin', 'branch_admin'));

-- New policy: everyone else sees own + team
CREATE POLICY "Users see own and team contacts"
  ON public.contacts FOR SELECT
  USING (created_by_user_id = ANY(get_my_team_user_ids()));
