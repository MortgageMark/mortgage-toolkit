-- ═══════════════════════════════════════════════════════════════════
-- App Access Migration
-- Adds app_access column to profiles so each user can be granted
-- access to specific apps: 'lmt', 'hlt', '1003', 'processor', 'crm'
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Add the column (default 'lmt' for any new users created going forward) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_access text[] DEFAULT ARRAY['lmt'];

-- ── Step 2: Grant all existing staff users access to both lmt and hlt ──
-- These are real users already working in the system — give them everything current.
UPDATE public.profiles
  SET app_access = ARRAY['lmt', 'hlt']
  WHERE role IN ('admin', 'internal', 'branch_admin')
    AND (app_access IS NULL OR app_access = ARRAY['lmt']);

-- ── Step 3: Verify ───────────────────────────────────────────────────
-- SELECT id, display_name, email, role, app_access
--   FROM public.profiles
--   ORDER BY role, display_name;

-- ── Future: when new apps launch, grant access like this ─────────────
-- UPDATE public.profiles
--   SET app_access = array_append(app_access, '1003')
--   WHERE id = '<user-uuid>';
--
-- Or grant to all admins at once:
-- UPDATE public.profiles
--   SET app_access = array_append(app_access, 'processor')
--   WHERE role = 'admin'
--     AND NOT ('processor' = ANY(app_access));
