-- ═══════════════════════════════════════════════════════════════════
-- Unified Contacts Migration
-- Merges lmt_contacts into HLT's contacts table so both apps share
-- one contact list. LMT-specific fields (company, cell_phone,
-- license_nmls, lmt_category) are added as new columns.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Add LMT fields to the shared contacts table ─────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company       text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS cell_phone    text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS license_nmls  text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lmt_category  text;
-- lmt_category stores LMT-specific values: Client, Realtor, Title,
-- HOI, Appraisal, Survey, LO, LOA, Processor, etc.
-- contact_category keeps HLT values: Loan: Third Party, Realtor, etc.

-- ── Step 2: Migrate lmt_contacts rows that haven't been synced ───────
DO $$
DECLARE
  v_user_id   uuid;
  v_tenant_id uuid;
BEGIN
  -- Use the admin user as the owner of migrated contacts
  SELECT id, tenant_id
    INTO v_user_id, v_tenant_id
    FROM public.profiles
   WHERE role = 'admin'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found in profiles — cannot migrate contacts.';
  END IF;

  -- Insert lmt_contacts that have never been pushed to HLT (hlt_contact_id IS NULL)
  INSERT INTO public.contacts (
    first_name, last_name, email, phone, cell_phone,
    company, license_nmls, notes,
    contact_category, contact_type, lmt_category,
    created_by_user_id, tenant_id, status
  )
  SELECT
    COALESCE(lc.first_name, ''),
    COALESCE(lc.last_name,  ''),
    COALESCE(lc.email,      ''),
    COALESCE(lc.phone,      ''),
    lc.cell_phone,
    lc.company,
    lc.license_nmls,
    lc.notes,
    -- Map LMT category → HLT contact_category
    CASE lc.category
      WHEN 'Client'      THEN 'Client'
      WHEN 'Realtor'     THEN 'Realtor'
      WHEN 'Builder'     THEN 'Home Builder'
      WHEN 'LO'          THEN 'Loan Officer'
      WHEN 'LOA'         THEN 'Employee'
      WHEN 'Setup'       THEN 'Employee'
      WHEN 'Processor'   THEN 'Employee'
      WHEN 'Underwriter' THEN 'Employee'
      WHEN 'Closer'      THEN 'Employee'
      WHEN 'Title'       THEN 'Loan: Third Party'
      WHEN 'Appraisal'   THEN 'Loan: Third Party'
      WHEN 'HOI'         THEN 'Loan: Third Party'
      WHEN 'Survey'      THEN 'Loan: Third Party'
      ELSE 'Other'
    END,
    -- contact_type: client for customer-facing, business for everyone else
    CASE WHEN lc.category IN ('Client','Realtor','Builder') THEN 'client' ELSE 'business' END,
    -- lmt_category: preserve the original LMT-specific category
    lc.category,
    v_user_id,
    v_tenant_id,
    'active'
  FROM public.lmt_contacts lc
  WHERE lc.hlt_contact_id IS NULL;

  -- For lmt_contacts that were already pushed to HLT (hlt_contact_id IS NOT NULL),
  -- back-fill the new LMT fields onto the existing contacts rows.
  UPDATE public.contacts c
  SET
    company      = COALESCE(c.company,      lc.company),
    cell_phone   = COALESCE(c.cell_phone,   lc.cell_phone),
    license_nmls = COALESCE(c.license_nmls, lc.license_nmls),
    lmt_category = COALESCE(c.lmt_category, lc.category)
  FROM public.lmt_contacts lc
  WHERE lc.hlt_contact_id = c.id;

  RAISE NOTICE 'Migration complete. Admin user: %, tenant: %', v_user_id, v_tenant_id;
END $$;

-- ── Step 3: Verify ───────────────────────────────────────────────────
-- Run these SELECT statements to confirm the migration looks right
-- before removing lmt_contacts.

-- SELECT count(*) FROM public.lmt_contacts;          -- original count
-- SELECT count(*) FROM public.contacts WHERE lmt_category IS NOT NULL; -- migrated count
-- SELECT lmt_category, contact_category, count(*)
--   FROM public.contacts WHERE lmt_category IS NOT NULL
--   GROUP BY 1, 2 ORDER BY 3 DESC;                   -- category mapping

-- ── Step 4 (optional, run AFTER confirming LMT works on contacts): ───
-- DROP TABLE public.lmt_contacts;
