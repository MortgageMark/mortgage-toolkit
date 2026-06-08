-- LMT People / Contacts
CREATE TABLE IF NOT EXISTS public.lmt_contacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL DEFAULT auth.uid(),
  tenant_id     uuid        NOT NULL DEFAULT public.get_my_tenant_id(),
  category      text        NOT NULL DEFAULT 'Client',
  first_name    text        DEFAULT '',
  last_name     text        DEFAULT '',
  company       text        DEFAULT '',
  email         text        DEFAULT '',
  phone         text        DEFAULT '',
  cell_phone    text        DEFAULT '',
  license_nmls  text        DEFAULT '',
  notes         text        DEFAULT '',
  hlt_contact_id uuid       REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.lmt_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LMT: users manage own contacts" ON public.lmt_contacts;
CREATE POLICY "LMT: users manage own contacts"
  ON public.lmt_contacts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT ALL ON public.lmt_contacts TO authenticated;
CREATE INDEX IF NOT EXISTS lmt_contacts_user_id_idx ON public.lmt_contacts (user_id);
CREATE INDEX IF NOT EXISTS lmt_contacts_category_idx ON public.lmt_contacts (category);
