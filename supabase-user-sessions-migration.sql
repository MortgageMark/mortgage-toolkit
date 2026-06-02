-- supabase-user-sessions-migration.sql
-- User session / login activity tracking.
-- Deploy in Supabase SQL Editor.
-- Records one row per login event; admin can query last-15-days activity.

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid          NOT NULL DEFAULT get_my_tenant_id(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  role         text,
  logged_in_at timestamptz   NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS user_sessions_tenant_time_idx
  ON public.user_sessions (tenant_id, logged_in_at DESC);

CREATE INDEX IF NOT EXISTS user_sessions_user_time_idx
  ON public.user_sessions (user_id, logged_in_at DESC);

-- 3. Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Admin/internal can read all sessions for their tenant
CREATE POLICY "Admins can read sessions"
  ON public.user_sessions
  FOR SELECT
  USING (
    get_my_role() IN ('admin', 'internal')
    AND tenant_id = get_my_tenant_id()
  );

-- 5. Any authenticated user can insert their own session record
CREATE POLICY "Users can insert own session"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 6. Optional: auto-purge rows older than 30 days
--    (Run this separately as a scheduled job if you want automatic cleanup)
-- DELETE FROM public.user_sessions WHERE logged_in_at < now() - interval '30 days';
