-- supabase-admin-delete-scenarios.sql
-- Adds DELETE policy so admins can delete any scenario in their tenant.
-- The original policy only allows users to delete their own scenarios,
-- which silently blocks admin deletes of borrower-owned scenarios.

DROP POLICY IF EXISTS "Admins can delete any scenario in tenant" ON public.scenarios;

CREATE POLICY "Admins can delete any scenario in tenant"
  ON public.scenarios
  FOR DELETE
  USING (
    get_my_role() IN ('super_admin', 'admin')
    AND tenant_id = get_my_tenant_id()
  );
