-- =============================================================================
-- MIGRATION: Teams & Branches Support
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / IF EXISTS throughout
-- =============================================================================


-- =============================================================================
-- SECTION 1: CREATE branches TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.branches (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid        NOT NULL DEFAULT get_my_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
    name       text        NOT NULL,
    nmls       text        DEFAULT '',
    address    text        DEFAULT '',
    city       text        DEFAULT '',
    state      text        DEFAULT '',
    zip        text        DEFAULT '',
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Policy: internal roles can read branches
DROP POLICY IF EXISTS "Internal can read branches" ON public.branches;
CREATE POLICY "Internal can read branches"
    ON public.branches
    FOR SELECT
    USING (get_my_role() IN ('super_admin', 'admin', 'branch_admin', 'internal'));

-- Policy: admins can manage (all operations on) branches
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Admins can manage branches"
    ON public.branches
    FOR ALL
    USING     (get_my_role() IN ('super_admin', 'admin'))
    WITH CHECK (get_my_role() IN ('super_admin', 'admin'));


-- =============================================================================
-- SECTION 2: ADD COLUMNS TO profiles
-- =============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS branch_id          uuid    REFERENCES public.branches(id),
    ADD COLUMN IF NOT EXISTS team_lead_id       uuid    REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS team_share_scenarios boolean NOT NULL DEFAULT true;


-- =============================================================================
-- SECTION 3: UPDATE role CHECK CONSTRAINT on profiles
-- =============================================================================

-- Drop existing constraint (safe if it doesn't exist)
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Re-add with expanded role list including branch_admin
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'admin', 'branch_admin', 'internal', 'borrower', 'realtor'));


-- =============================================================================
-- SECTION 4: get_my_role() FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role
      INTO v_role
      FROM public.profiles
     WHERE id = auth.uid();

    RETURN v_role;
END;
$$;


-- =============================================================================
-- SECTION 5: get_my_team_lead_id() FUNCTION
-- Returns the team lead's user ID if the current user has one assigned,
-- otherwise returns the current user's own ID (they are standalone or a lead).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_team_lead_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_team_lead_id uuid;
BEGIN
    SELECT COALESCE(team_lead_id, auth.uid())
      INTO v_team_lead_id
      FROM public.profiles
     WHERE id = auth.uid();

    RETURN v_team_lead_id;
END;
$$;


-- =============================================================================
-- SECTION 6: my_team_shares_scenarios() FUNCTION
-- If the current user has a team lead, returns that lead's team_share_scenarios.
-- If the current user is a standalone or team lead, returns their own value.
-- COALESCEs to false as a safe default.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.my_team_shares_scenarios()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_team_lead_id        uuid;
    v_share_scenarios     boolean;
BEGIN
    -- Get current user's team_lead_id (null if they are standalone/lead)
    SELECT team_lead_id
      INTO v_team_lead_id
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_team_lead_id IS NOT NULL THEN
        -- Return the team lead's sharing preference
        SELECT COALESCE(team_share_scenarios, false)
          INTO v_share_scenarios
          FROM public.profiles
         WHERE id = v_team_lead_id;
    ELSE
        -- No team lead: return own sharing preference
        SELECT COALESCE(team_share_scenarios, false)
          INTO v_share_scenarios
          FROM public.profiles
         WHERE id = auth.uid();
    END IF;

    RETURN COALESCE(v_share_scenarios, false);
END;
$$;


-- =============================================================================
-- SECTION 7: DROP EXISTING scenarios SELECT POLICIES
-- Cleans up all prior naming variations before recreating
-- =============================================================================

DROP POLICY IF EXISTS "Internal users can view all scenarios in tenant" ON public.scenarios;
DROP POLICY IF EXISTS "Admins can view all scenarios"                   ON public.scenarios;
DROP POLICY IF EXISTS "Users can view own scenarios"                    ON public.scenarios;
DROP POLICY IF EXISTS "Internal can read all scenarios"                 ON public.scenarios;
DROP POLICY IF EXISTS "Users can select their own scenarios"            ON public.scenarios;
DROP POLICY IF EXISTS "Scenario visibility: own + team + admin"         ON public.scenarios;


-- =============================================================================
-- SECTION 8: CREATE UNIFIED scenarios SELECT POLICY
-- Covers:
--   • Own scenarios (any role)
--   • super_admin / admin: see all in tenant
--   • branch_admin: see all in tenant
--   • internal with sharing enabled: see teammates' and team lead's scenarios
-- =============================================================================

CREATE POLICY "Scenario visibility: own + team + admin"
    ON public.scenarios
    FOR SELECT
    USING (
        tenant_id = get_my_tenant_id()
        AND (
            -- Always see your own scenarios
            user_id = auth.uid()

            -- Admins see everything in the tenant
            OR get_my_role() IN ('super_admin', 'admin')

            -- Branch admins see everything in the tenant
            OR get_my_role() = 'branch_admin'

            -- Internal users with team sharing enabled see teammates' scenarios
            OR (
                get_my_role() = 'internal'
                AND my_team_shares_scenarios()
                AND (
                    -- Teammate: scenario owner shares the same team lead as me
                    -- (and is not me — already covered by user_id = auth.uid())
                    EXISTS (
                        SELECT 1
                          FROM public.profiles AS owner
                         WHERE owner.id             = scenarios.user_id
                           AND owner.team_lead_id   IS NOT NULL
                           AND owner.team_lead_id   = get_my_team_lead_id()
                           AND owner.id            != auth.uid()
                    )

                    -- Scenario owner IS my team lead
                    OR scenarios.user_id = (
                        SELECT team_lead_id
                          FROM public.profiles
                         WHERE id = auth.uid()
                    )

                    -- I am the team lead and the scenario owner is on my team
                    OR EXISTS (
                        SELECT 1
                          FROM public.profiles AS mem
                         WHERE mem.id           = scenarios.user_id
                           AND mem.team_lead_id = auth.uid()
                    )
                )
            )
        )
    );
