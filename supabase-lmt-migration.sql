-- =============================================================================
-- supabase-lmt-migration.sql
-- Loan Manager Toolkit (LMT) — Pipeline Management Tables
-- Run in Supabase SQL Editor (same project as HLT)
-- IDEMPOTENT: safe to run multiple times
-- =============================================================================
-- Tables created:
--   1. lmt_deals              — one row per loan file
--   2. lmt_coborrowers        — co-borrowers on a deal
--   3. lmt_milestones         — milestone tracking per deal
--   4. lmt_milestone_presets  — turntime presets per user
--   5. lmt_email_templates    — Google Doc templates per user
--   6. lmt_deal_notes         — append-only notes per deal
-- =============================================================================


-- =============================================================================
-- TABLE 1: lmt_deals
-- Core pipeline record. One row = one loan in process.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_deals (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                                    REFERENCES public.tenants(id) ON DELETE RESTRICT,
  created_by_user_id    uuid        DEFAULT auth.uid()
                                    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Borrower (linked to HLT contact if available, otherwise freetext)
  primary_contact_id    uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  primary_borrower_name text        NOT NULL DEFAULT '',
  primary_borrower_email text       DEFAULT '',
  primary_borrower_phone text       DEFAULT '',

  -- Property
  property_address      text        DEFAULT '',
  city                  text        DEFAULT '',
  state                 text        DEFAULT '',
  zip                   text        DEFAULT '',

  -- Loan details
  file_number           text        DEFAULT '',
  loan_amount           numeric     DEFAULT 0,
  loan_program          text        DEFAULT '',  -- Conv, FHA, VA, USDA, HELOC, etc.
  loan_term             integer     DEFAULT 30,
  rate                  numeric     DEFAULT 0,
  trans_type            text        DEFAULT 'purchase'
                                    CHECK (trans_type IN ('purchase', 'refinance', 'heloc', 'other')),
  prop_type             text        DEFAULT 'SFR'
                                    CHECK (prop_type IN ('SFR', 'Condo', 'Townhome', 'Multi-Family', 'Manufactured', 'Other')),

  -- Team assignments
  assigned_lo_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_loa_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_processor_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Key dates
  closing_date          date,                   -- null = TBD
  lock_expiration_date  date,
  third_party_exp_date  date,
  contract_received_date date,

  -- Status (customizable per LO — stored as text, validated in app)
  status                text        NOT NULL DEFAULT 'Not Submitted',

  -- Quick note visible on pipeline table
  quick_note            text        DEFAULT '',

  -- Soft delete / archive
  archived              boolean     NOT NULL DEFAULT false,
  archived_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lmt_deals IS
  'LMT pipeline deals. One row per loan file. Multi-tenant. '
  'primary_contact_id links to HLT contacts when both products are active.';


-- =============================================================================
-- TABLE 2: lmt_coborrowers
-- Co-borrowers on a deal. One deal can have multiple co-borrowers.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_coborrowers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                                REFERENCES public.tenants(id) ON DELETE RESTRICT,
  deal_id           uuid        NOT NULL
                                REFERENCES public.lmt_deals(id) ON DELETE CASCADE,
  contact_id        uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Freetext fallback when no HLT contact exists
  name              text        NOT NULL DEFAULT '',
  email             text        DEFAULT '',
  phone             text        DEFAULT '',

  -- Display order on the deal (1 = first listed co-borrower)
  sort_order        integer     NOT NULL DEFAULT 1,

  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lmt_coborrowers IS
  'Co-borrowers on an LMT deal. contact_id links to HLT contacts when available.';


-- =============================================================================
-- TABLE 3: lmt_milestones
-- One row per milestone category per deal.
-- Categories: title, appraisal, hoi, voe, flood, payoff, vor,
--             icd, le, disclosure, contract, file
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_milestones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                              REFERENCES public.tenants(id) ON DELETE RESTRICT,
  deal_id         uuid        NOT NULL
                              REFERENCES public.lmt_deals(id) ON DELETE CASCADE,

  -- Which milestone this row represents
  milestone_type  text        NOT NULL
                              CHECK (milestone_type IN (
                                'title', 'appraisal', 'hoi', 'voe',
                                'flood', 'payoff', 'vor', 'icd',
                                'le', 'disclosure', 'contract', 'file',
                                'other'
                              )),

  -- Milestone lifecycle dates
  ordered_date    date,
  due_date        date,       -- auto-calculated from ordered_date + preset turntime
  followup_date   date,       -- user-set follow-up date
  received_date   date,

  -- Status flags
  is_na           boolean     NOT NULL DEFAULT false,   -- not applicable to this loan
  is_done         boolean     NOT NULL DEFAULT false,   -- received / complete

  -- Free note on this milestone
  notes           text        DEFAULT '',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One row per milestone type per deal
  UNIQUE (deal_id, milestone_type)
);

COMMENT ON TABLE public.lmt_milestones IS
  'Milestone tracking per deal. One row per milestone type. '
  'due_date auto-calculated in app from ordered_date + user turntime preset.';


-- =============================================================================
-- TABLE 4: lmt_milestone_presets
-- Turntime presets per user. "Title = 4 days" means due_date = ordered + 4.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_milestone_presets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                              REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id         uuid        NOT NULL DEFAULT auth.uid()
                              REFERENCES public.profiles(id) ON DELETE CASCADE,

  milestone_type  text        NOT NULL
                              CHECK (milestone_type IN (
                                'title', 'appraisal', 'hoi', 'voe',
                                'flood', 'payoff', 'vor', 'icd',
                                'le', 'disclosure', 'contract', 'file',
                                'other'
                              )),

  turntime_days   integer     NOT NULL DEFAULT 3,  -- expected business days to receive
  followup_days   integer     NOT NULL DEFAULT 1,  -- days after ordered to follow up

  -- Alert window: warn N days before due date
  alert_days_before integer   NOT NULL DEFAULT 1,

  -- One preset per milestone type per user
  UNIQUE (user_id, milestone_type),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lmt_milestone_presets IS
  'Per-user turntime presets. When a milestone is ordered, due_date = '
  'ordered_date + turntime_days. Alert fires alert_days_before due_date.';


-- =============================================================================
-- TABLE 5: lmt_email_templates
-- Google Doc templates per user. Multiple docs per user allowed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_email_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                              REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id         uuid        NOT NULL DEFAULT auth.uid()
                              REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Human-readable name: "Title Order Email", "Appraisal Request", etc.
  name            text        NOT NULL DEFAULT '',

  -- Which milestone this template is used for (null = general / manual use)
  milestone_type  text        CHECK (milestone_type IN (
                                'title', 'appraisal', 'hoi', 'voe',
                                'flood', 'payoff', 'vor', 'icd',
                                'le', 'disclosure', 'contract', 'file',
                                'other'
                              )),

  -- The Google Doc URL the system reads to build the email body
  google_doc_url  text        NOT NULL DEFAULT '',

  -- Optional description / notes for the LO
  description     text        DEFAULT '',

  -- Whether this template auto-triggers when a milestone is ordered
  auto_trigger    boolean     NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lmt_email_templates IS
  'Google Doc email templates per user. System reads the Doc, replaces '
  'placeholders ({{borrower_name}} etc.), and sends via email. '
  'Multiple templates per user allowed.';


-- =============================================================================
-- TABLE 6: lmt_deal_notes
-- Append-only notes per deal. No edits, no deletes — permanent log.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lmt_deal_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL DEFAULT public.get_my_tenant_id()
                          REFERENCES public.tenants(id) ON DELETE RESTRICT,
  deal_id     uuid        NOT NULL
                          REFERENCES public.lmt_deals(id) ON DELETE CASCADE,
  user_id     uuid        DEFAULT auth.uid()
                          REFERENCES public.profiles(id) ON DELETE SET NULL,

  body        text        NOT NULL DEFAULT '',

  -- No updated_at — notes are immutable after insert
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lmt_deal_notes IS
  'Append-only notes per LMT deal. No UPDATE/DELETE policies = immutable log.';


-- =============================================================================
-- TRIGGERS: updated_at auto-maintenance
-- =============================================================================

-- lmt_deals
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.lmt_deals'::regclass
    AND tgname = 'lmt_deals_set_updated_at'
  ) THEN
    CREATE TRIGGER lmt_deals_set_updated_at
      BEFORE UPDATE ON public.lmt_deals
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$do$;

-- lmt_milestones
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.lmt_milestones'::regclass
    AND tgname = 'lmt_milestones_set_updated_at'
  ) THEN
    CREATE TRIGGER lmt_milestones_set_updated_at
      BEFORE UPDATE ON public.lmt_milestones
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$do$;

-- lmt_milestone_presets
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.lmt_milestone_presets'::regclass
    AND tgname = 'lmt_milestone_presets_set_updated_at'
  ) THEN
    CREATE TRIGGER lmt_milestone_presets_set_updated_at
      BEFORE UPDATE ON public.lmt_milestone_presets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$do$;

-- lmt_email_templates
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.lmt_email_templates'::regclass
    AND tgname = 'lmt_email_templates_set_updated_at'
  ) THEN
    CREATE TRIGGER lmt_email_templates_set_updated_at
      BEFORE UPDATE ON public.lmt_email_templates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$do$;


-- =============================================================================
-- INDEXES
-- =============================================================================

-- lmt_deals
CREATE INDEX IF NOT EXISTS lmt_deals_tenant_id_idx        ON public.lmt_deals (tenant_id);
CREATE INDEX IF NOT EXISTS lmt_deals_assigned_lo_idx      ON public.lmt_deals (assigned_lo_id);
CREATE INDEX IF NOT EXISTS lmt_deals_status_idx           ON public.lmt_deals (tenant_id, status);
CREATE INDEX IF NOT EXISTS lmt_deals_closing_date_idx     ON public.lmt_deals (closing_date);
CREATE INDEX IF NOT EXISTS lmt_deals_archived_idx         ON public.lmt_deals (tenant_id, archived);
CREATE INDEX IF NOT EXISTS lmt_deals_contact_id_idx       ON public.lmt_deals (primary_contact_id)
  WHERE primary_contact_id IS NOT NULL;

-- lmt_coborrowers
CREATE INDEX IF NOT EXISTS lmt_coborrowers_deal_id_idx    ON public.lmt_coborrowers (deal_id);

-- lmt_milestones
CREATE INDEX IF NOT EXISTS lmt_milestones_deal_id_idx     ON public.lmt_milestones (deal_id);
CREATE INDEX IF NOT EXISTS lmt_milestones_due_date_idx    ON public.lmt_milestones (due_date)
  WHERE due_date IS NOT NULL AND is_done = false AND is_na = false;

-- lmt_deal_notes
CREATE INDEX IF NOT EXISTS lmt_deal_notes_deal_id_idx     ON public.lmt_deal_notes (deal_id, created_at DESC);

-- lmt_email_templates
CREATE INDEX IF NOT EXISTS lmt_email_templates_user_id_idx ON public.lmt_email_templates (user_id);

-- lmt_milestone_presets
CREATE INDEX IF NOT EXISTS lmt_milestone_presets_user_id_idx ON public.lmt_milestone_presets (user_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.lmt_deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lmt_coborrowers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lmt_milestones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lmt_milestone_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lmt_email_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lmt_deal_notes        ENABLE ROW LEVEL SECURITY;

-- ── lmt_deals ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: internal can view deals in tenant"  ON public.lmt_deals;
DROP POLICY IF EXISTS "LMT: internal can insert deals"          ON public.lmt_deals;
DROP POLICY IF EXISTS "LMT: internal can update deals"          ON public.lmt_deals;
DROP POLICY IF EXISTS "LMT: admins can delete deals"            ON public.lmt_deals;

CREATE POLICY "LMT: internal can view deals in tenant"
  ON public.lmt_deals FOR SELECT
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

CREATE POLICY "LMT: internal can insert deals"
  ON public.lmt_deals FOR INSERT
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

CREATE POLICY "LMT: internal can update deals"
  ON public.lmt_deals FOR UPDATE
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'))
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

CREATE POLICY "LMT: admins can delete deals"
  ON public.lmt_deals FOR DELETE
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin'));

-- ── lmt_coborrowers ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: internal can manage coborrowers" ON public.lmt_coborrowers;

CREATE POLICY "LMT: internal can manage coborrowers"
  ON public.lmt_coborrowers FOR ALL
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'))
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

-- ── lmt_milestones ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: internal can manage milestones" ON public.lmt_milestones;

CREATE POLICY "LMT: internal can manage milestones"
  ON public.lmt_milestones FOR ALL
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'))
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

-- ── lmt_milestone_presets ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: users manage own presets" ON public.lmt_milestone_presets;

CREATE POLICY "LMT: users manage own presets"
  ON public.lmt_milestone_presets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── lmt_email_templates ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: users manage own templates" ON public.lmt_email_templates;

CREATE POLICY "LMT: users manage own templates"
  ON public.lmt_email_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── lmt_deal_notes ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "LMT: internal can view deal notes"   ON public.lmt_deal_notes;
DROP POLICY IF EXISTS "LMT: internal can insert deal notes" ON public.lmt_deal_notes;

CREATE POLICY "LMT: internal can view deal notes"
  ON public.lmt_deal_notes FOR SELECT
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

CREATE POLICY "LMT: internal can insert deal notes"
  ON public.lmt_deal_notes FOR INSERT
  WITH CHECK (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('super_admin','admin','branch_admin','internal'));

-- No UPDATE or DELETE on deal notes — immutable log


-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT ALL ON public.lmt_deals             TO authenticated;
GRANT ALL ON public.lmt_coborrowers       TO authenticated;
GRANT ALL ON public.lmt_milestones        TO authenticated;
GRANT ALL ON public.lmt_milestone_presets TO authenticated;
GRANT ALL ON public.lmt_email_templates   TO authenticated;
GRANT ALL ON public.lmt_deal_notes        TO authenticated;


-- =============================================================================
-- VERIFICATION (uncomment to confirm migration ran correctly)
-- =============================================================================

/*

-- 1. Confirm all 6 tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'lmt_deals','lmt_coborrowers','lmt_milestones',
    'lmt_milestone_presets','lmt_email_templates','lmt_deal_notes'
  )
ORDER BY table_name;
-- Expected: 6 rows

-- 2. Confirm RLS is enabled on all 6 tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'lmt_deals','lmt_coborrowers','lmt_milestones',
    'lmt_milestone_presets','lmt_email_templates','lmt_deal_notes'
  )
ORDER BY tablename;
-- Expected: 6 rows, all rowsecurity = true

-- 3. Confirm indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'lmt_%'
ORDER BY tablename, indexname;

*/

-- =============================================================================
-- END supabase-lmt-migration.sql
-- Next step: build lmt.html (pipeline table UI)
-- =============================================================================
