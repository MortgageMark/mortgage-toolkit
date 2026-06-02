-- Partnerships table: mutual LO ↔ Realtor/Builder connections
CREATE TABLE IF NOT EXISTS public.partnerships (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL DEFAULT get_my_tenant_id(),
  lo_user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_contact_id uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  partner_email      text        NOT NULL,
  partner_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','active','declined')),
  initiated_by       uuid        NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS partnerships_lo_user_idx      ON public.partnerships (lo_user_id);
CREATE INDEX IF NOT EXISTS partnerships_partner_uid_idx  ON public.partnerships (partner_user_id);
CREATE INDEX IF NOT EXISTS partnerships_partner_email_idx ON public.partnerships (lower(partner_email));

-- RLS
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- LO can see their own partnerships
CREATE POLICY "LO sees own partnerships"
  ON public.partnerships FOR SELECT
  USING (lo_user_id = auth.uid());

-- Partner (Realtor/Builder) can see invites sent to their email or user_id
CREATE POLICY "Partner sees own invites"
  ON public.partnerships FOR SELECT
  USING (
    partner_user_id = auth.uid()
    OR lower(partner_email) = lower(auth.jwt() ->> 'email')
  );

-- LO can create partnerships
CREATE POLICY "LO can create partnerships"
  ON public.partnerships FOR INSERT
  WITH CHECK (lo_user_id = auth.uid());

-- Either party can update status (accept/decline/unlink)
CREATE POLICY "Either party can update partnership"
  ON public.partnerships FOR UPDATE
  USING (
    lo_user_id = auth.uid()
    OR partner_user_id = auth.uid()
    OR lower(partner_email) = lower(auth.jwt() ->> 'email')
  );

-- Either party can delete (unlink)
CREATE POLICY "Either party can delete partnership"
  ON public.partnerships FOR DELETE
  USING (
    lo_user_id = auth.uid()
    OR partner_user_id = auth.uid()
  );
