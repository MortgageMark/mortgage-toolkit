-- =============================================================================
-- supabase-contacts.sql
-- Contacts Module — tables, indexes, RLS, and grants
-- Run AFTER supabase-tenant-migration.sql (depends on: tenants, profiles,
-- scenarios, get_my_role(), get_my_tenant_id())
-- =============================================================================
-- IDEMPOTENT: safe to run multiple times. All DDL uses IF NOT EXISTS,
-- CREATE OR REPLACE, DO-block guards, and DROP ... IF EXISTS.
-- =============================================================================
-- Prerequisites verified:
--   ✅ public.tenants  table exists (from tenant migration)
--   ✅ public.profiles table exists (from supabase-profiles.sql)
--   ✅ public.scenarios table exists (from supabase-schema.sql)
--   ✅ public.get_my_role()      SECURITY DEFINER function exists
--   ✅ public.get_my_tenant_id() SECURITY DEFINER function exists
-- =============================================================================


-- =============================================================================
-- STEP 1: contacts table
-- Core CRM record: leads, borrowers, realtors, builders, etc.
-- tenant_id and created_by_user_id default via DB functions — zero frontend
-- code changes needed when ContactsTab.js is built.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy — mandatory; defaults via SECURITY DEFINER function
  -- so frontend INSERT never needs to pass tenant_id explicitly.
  tenant_id           uuid        NOT NULL
                      DEFAULT public.get_my_tenant_id()
                      REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- Who created the record
  created_by_user_id  uuid
                      DEFAULT auth.uid()
                      REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identity
  first_name          text        NOT NULL DEFAULT '',
  last_name           text        NOT NULL DEFAULT '',
  email               text                 DEFAULT '',
  phone               text                 DEFAULT '',

  -- Address (flat — borrower's current address or realtor's office)
  address             text                 DEFAULT '',
  city                text                 DEFAULT '',
  state               text                 DEFAULT '',
  zip                 text                 DEFAULT '',

  -- Classification
  contact_type        text        NOT NULL DEFAULT 'lead'
                      CHECK (contact_type IN ('lead','borrower','realtor','builder','other')),

  -- Lifecycle
  status              text        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','archived','converted')),

  -- Freeform / flexible
  tags                text[]               DEFAULT '{}',
  source              text                 DEFAULT '',   -- e.g. 'Zillow', 'Referral', 'Open House'

  -- Quick memo field on the contact record itself.
  -- contact_notes table = append-only log; this field = LO's running note.
  notes               text                 DEFAULT '',

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contacts IS
  'CRM contact records. Multi-tenant: all rows scoped by tenant_id. '
  'Supports leads, borrowers, realtors, builders, and other contact types.';

COMMENT ON COLUMN public.contacts.notes IS
  'Short running note on the contact itself. For an append-only log of '
  'interactions use the contact_notes table instead.';


-- =============================================================================
-- STEP 2: contact_notes table (append-only interaction log)
-- No updated_at column. No UPDATE or DELETE RLS policies will be created.
-- The absence of those policies IS the immutability enforcement.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id   uuid        NOT NULL
              DEFAULT public.get_my_tenant_id()
              REFERENCES public.tenants(id) ON DELETE RESTRICT,

  contact_id  uuid        NOT NULL
              REFERENCES public.contacts(id) ON DELETE CASCADE,

  user_id     uuid
              DEFAULT auth.uid()
              REFERENCES public.profiles(id) ON DELETE SET NULL,

  body        text        NOT NULL DEFAULT '',

  -- No updated_at — notes are immutable after insert
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contact_notes IS
  'Append-only interaction log for contacts. Once inserted a note cannot '
  'be edited or deleted (no UPDATE/DELETE RLS policies exist).';


-- =============================================================================
-- STEP 3: intake_links table (Phase 2 placeholder)
-- Created now with tenant_id native — avoids a costly migration later.
-- The 1003 intake app (Phase 2) will use an Edge Function with the service-role
-- key to verify tokens; no anon grants are needed on this table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.intake_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id           uuid        NOT NULL
                      DEFAULT public.get_my_tenant_id()
                      REFERENCES public.tenants(id) ON DELETE RESTRICT,

  contact_id          uuid        NOT NULL
                      REFERENCES public.contacts(id) ON DELETE CASCADE,

  created_by_user_id  uuid
                      DEFAULT auth.uid()
                      REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Secure random token — unique across all tenants (no guessable IDs)
  token               text        NOT NULL UNIQUE
                      DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Data that will pre-fill the 1003 form for the borrower
  seed_payload        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  expires_at          timestamptz,            -- null = never expires
  used_at             timestamptz,            -- null = link not yet used

  created_at          timestamptz NOT NULL DEFAULT now()
  -- No updated_at needed — only expires_at and used_at change;
  -- a trigger would be noise here.
);

COMMENT ON TABLE public.intake_links IS
  'Phase 2 placeholder. Stores time-limited borrower intake tokens '
  'generated by the LO to pre-fill the standalone 1003 application. '
  'Token verification will be handled by a Supabase Edge Function using '
  'the service-role key — no anon grants required on this table.';


-- =============================================================================
-- STEP 4: Add contact_id to scenarios (nullable FK — safe for existing rows)
-- Linking scenarios to a contact is Phase 1 / ContactDetail work.
-- Existing scenarios keep contact_id = NULL; new ones will be linked.
-- The storage.js saveScenarioToSupabase function does not need updating —
-- the column defaults to null when not supplied.
-- =============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'scenarios'
      AND  column_name  = 'contact_id'
  ) THEN
    ALTER TABLE public.scenarios
      ADD COLUMN contact_id uuid
        REFERENCES public.contacts(id) ON DELETE SET NULL;

    COMMENT ON COLUMN public.scenarios.contact_id IS
      'Links a scenario to a CRM contact. Nullable — existing scenarios '
      'without a linked contact remain valid.';
  END IF;
END;
$do$;


-- =============================================================================
-- STEP 5: set_updated_at() trigger function + contacts trigger
-- CREATE OR REPLACE is idempotent — safe whether or not the function was
-- already created by supabase-tenant-migration.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$func$;

-- Attach to contacts only — contact_notes is append-only (no updated_at)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgrelid = 'public.contacts'::regclass
      AND  tgname  = 'contacts_set_updated_at'
  ) THEN
    CREATE TRIGGER contacts_set_updated_at
      BEFORE UPDATE ON public.contacts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$do$;


-- =============================================================================
-- STEP 6: Indexes
-- All use IF NOT EXISTS (Postgres 9.5+). Nine indexes across four tables.
-- =============================================================================

-- contacts ----------------------------------------------------------------

-- Primary tenant filter (used in every RLS policy check)
CREATE INDEX IF NOT EXISTS contacts_tenant_id_idx
  ON public.contacts (tenant_id);

-- Filtered list views: "show me all borrowers" or "show me all leads"
CREATE INDEX IF NOT EXISTS contacts_tenant_type_idx
  ON public.contacts (tenant_id, contact_type);

-- Lifecycle filter: active vs archived vs converted
CREATE INDEX IF NOT EXISTS contacts_tenant_status_idx
  ON public.contacts (tenant_id, status);

-- Borrower self-access policy: lower() on both sides for case-insensitive
-- email comparison. Partial: skips blank emails (very common for non-borrowers).
CREATE INDEX IF NOT EXISTS contacts_tenant_email_idx
  ON public.contacts (tenant_id, lower(email))
  WHERE email <> '';

-- contact_notes -----------------------------------------------------------

-- The most common query: "show all notes for contact X, newest first"
CREATE INDEX IF NOT EXISTS contact_notes_contact_id_idx
  ON public.contact_notes (contact_id, created_at DESC);

-- Tenant-level queries (admin views, bulk export)
CREATE INDEX IF NOT EXISTS contact_notes_tenant_id_idx
  ON public.contact_notes (tenant_id);

-- intake_links ------------------------------------------------------------

-- Token lookup (Edge Function verify path) — token column is also UNIQUE
-- so this is technically redundant but explicit for readability
CREATE INDEX IF NOT EXISTS intake_links_token_idx
  ON public.intake_links (token);

-- "Show all intake links for contact X"
CREATE INDEX IF NOT EXISTS intake_links_contact_id_idx
  ON public.intake_links (contact_id);

-- scenarios (new column) --------------------------------------------------

-- "Show all scenarios linked to contact X" — partial (skips unlinked rows)
CREATE INDEX IF NOT EXISTS scenarios_contact_id_idx
  ON public.scenarios (contact_id)
  WHERE contact_id IS NOT NULL;


-- =============================================================================
-- STEP 7: RLS on contacts
-- Enable RLS, then define five policies:
--   • Internal users (admin / internal) → full CRUD within their tenant
--   • Borrowers / realtors             → read their own contact record only
--   • Admins only                       → delete (not internal — delete is destructive)
-- NOTE: Roles are 'admin', 'internal', 'borrower', 'realtor'
--       ('lo' is NOT a valid role — see tenant migration for the fix)
-- =============================================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Drop then recreate — idempotent pattern used throughout this project
DROP POLICY IF EXISTS "Internal users can view all contacts"    ON public.contacts;
DROP POLICY IF EXISTS "Borrowers can view own contact record"   ON public.contacts;
DROP POLICY IF EXISTS "Internal users can insert contacts"      ON public.contacts;
DROP POLICY IF EXISTS "Internal users can update contacts"      ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts"              ON public.contacts;

-- SELECT: internal team sees all contacts in their tenant
CREATE POLICY "Internal users can view all contacts"
  ON public.contacts
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- SELECT: borrowers / realtors can see their own contact record only.
-- Case-insensitive email match (Supabase Auth email may differ in case from
-- the email the LO typed). Uses the partial functional index created in Step 6.
CREATE POLICY "Borrowers can view own contact record"
  ON public.contacts
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('borrower', 'realtor')
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

-- INSERT: internal team only; tenant_id is set by DEFAULT so no explicit check
-- on the value is needed here (the DEFAULT handles it). The USING clause
-- ensures only internal users can trigger an insert at all.
CREATE POLICY "Internal users can insert contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- UPDATE: internal team only; both USING and WITH CHECK enforce tenant scope
CREATE POLICY "Internal users can update contacts"
  ON public.contacts
  FOR UPDATE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- DELETE: admin only (not internal — deletes are destructive)
CREATE POLICY "Admins can delete contacts"
  ON public.contacts
  FOR DELETE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() = 'admin'
  );


-- =============================================================================
-- STEP 8: RLS on contact_notes (append-only — two policies only)
-- The absence of UPDATE and DELETE policies enforces immutability.
-- =============================================================================

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view contact notes"   ON public.contact_notes;
DROP POLICY IF EXISTS "Internal users can insert contact notes" ON public.contact_notes;

-- SELECT
CREATE POLICY "Internal users can view contact notes"
  ON public.contact_notes
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- INSERT
CREATE POLICY "Internal users can insert contact notes"
  ON public.contact_notes
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- No UPDATE policy  — notes cannot be edited after creation
-- No DELETE policy  — notes cannot be deleted (permanent audit trail)


-- =============================================================================
-- STEP 9: RLS on intake_links
-- Internal team can view, insert, and update (to mark used_at or extend
-- expiry). No delete policy — links are preserved for audit purposes.
-- =============================================================================

ALTER TABLE public.intake_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view intake links"   ON public.intake_links;
DROP POLICY IF EXISTS "Internal users can insert intake links" ON public.intake_links;
DROP POLICY IF EXISTS "Internal users can update intake links" ON public.intake_links;

-- SELECT
CREATE POLICY "Internal users can view intake links"
  ON public.intake_links
  FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- INSERT
CREATE POLICY "Internal users can insert intake links"
  ON public.intake_links
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- UPDATE (mark used_at, update seed_payload, extend/set expires_at)
CREATE POLICY "Internal users can update intake links"
  ON public.intake_links
  FOR UPDATE
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('admin', 'internal')
  );

-- No DELETE policy — intake links are preserved for audit


-- =============================================================================
-- STEP 10: Grants
-- RLS is the real security boundary; these grants make the tables visible
-- to the authenticated role at all. Anon is intentionally excluded.
-- =============================================================================

GRANT ALL ON public.contacts      TO authenticated;
GRANT ALL ON public.contact_notes TO authenticated;
GRANT ALL ON public.intake_links  TO authenticated;


-- =============================================================================
-- STEP 11: Verification queries
-- Uncomment any block to confirm the migration ran correctly.
-- All are read-only SELECTs — safe to run at any time.
-- =============================================================================

/*

-- 1. Confirm all three new tables exist
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN ('contacts', 'contact_notes', 'intake_links')
ORDER BY table_name;
-- Expected: 3 rows

-- 2. Confirm contact_id column added to scenarios
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'scenarios'
  AND  column_name  = 'contact_id';
-- Expected: 1 row, data_type = 'uuid', is_nullable = 'YES'

-- 3. Confirm RLS is enabled on all three tables
SELECT tablename, rowsecurity
FROM   pg_tables
WHERE  schemaname = 'public'
  AND  tablename IN ('contacts', 'contact_notes', 'intake_links')
ORDER BY tablename;
-- Expected: 3 rows, all rowsecurity = true

-- 4. Confirm all 9 RLS policies exist
SELECT tablename, policyname, cmd
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename IN ('contacts', 'contact_notes', 'intake_links')
ORDER BY tablename, policyname;
-- Expected: 9 rows:
--   contacts      (5): view-all-internal, view-own-borrower, insert, update, delete-admin
--   contact_notes (2): view-internal, insert-internal
--   intake_links  (3): view-internal, insert-internal, update-internal

-- 5. Confirm all 9 indexes exist
SELECT indexname, tablename
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  tablename  IN ('contacts', 'contact_notes', 'intake_links', 'scenarios')
  AND  indexname  IN (
    'contacts_tenant_id_idx',
    'contacts_tenant_type_idx',
    'contacts_tenant_status_idx',
    'contacts_tenant_email_idx',
    'contact_notes_contact_id_idx',
    'contact_notes_tenant_id_idx',
    'intake_links_token_idx',
    'intake_links_contact_id_idx',
    'scenarios_contact_id_idx'
  )
ORDER BY tablename, indexname;
-- Expected: 9 rows

-- 6. Confirm updated_at trigger on contacts
SELECT tgname, tgrelid::regclass AS table_name, tgenabled
FROM   pg_trigger
WHERE  tgrelid = 'public.contacts'::regclass
  AND  tgname  = 'contacts_set_updated_at';
-- Expected: 1 row, tgenabled = 'O' (origin — fires normally)

*/

-- =============================================================================
-- END supabase-contacts.sql
-- Run next: Update CLAUDE.md and ROADMAP.md to document completed migration.
-- =============================================================================
