-- supabase-scenario-id-migration.sql
-- Adds scenario_id (human-readable UID like "260322-0001") to scenarios table
-- Safe to re-run (uses IF NOT EXISTS)

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS scenario_id text;

CREATE INDEX IF NOT EXISTS scenarios_scenario_id_idx
  ON public.scenarios (scenario_id);
