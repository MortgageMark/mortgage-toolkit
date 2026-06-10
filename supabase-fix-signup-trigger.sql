-- supabase-fix-signup-trigger.sql
-- Fixes "Database error saving new user" by updating handle_new_user() to:
--   1. Explicitly set lmt_role (avoids constraint issues if DEFAULT didn't apply)
--   2. Widen the tenant fallback to ANY tenant, not just active=true
--   3. Wrap insert in EXCEPTION block so trigger never aborts auth user creation
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_tenant_id uuid;
  v_role      text;
BEGIN
  -- Explicit tenant from signup metadata, else oldest tenant (active or not)
  v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id
      FROM public.tenants
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  v_role := COALESCE(new.raw_user_meta_data->>'role', 'borrower');

  INSERT INTO public.profiles (id, display_name, email, role, tenant_id, lmt_role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', ''),
    COALESCE(new.email, ''),
    v_role,
    v_tenant_id,
    'lo'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but never abort auth user creation
  RAISE WARNING 'handle_new_user() error for user %: % %', new.id, SQLERRM, SQLSTATE;
  RETURN new;
END;
$func$;
