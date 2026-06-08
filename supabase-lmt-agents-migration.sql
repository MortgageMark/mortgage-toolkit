-- Add agent fields to lmt_deals
ALTER TABLE public.lmt_deals
  ADD COLUMN IF NOT EXISTS buyers_agent        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS buyers_agent_email  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS buyers_agent_phone  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sellers_agent       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sellers_agent_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sellers_agent_phone text DEFAULT '';
