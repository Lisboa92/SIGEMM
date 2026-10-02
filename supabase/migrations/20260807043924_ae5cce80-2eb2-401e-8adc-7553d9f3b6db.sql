
ALTER TABLE public.cancel_requests
  ADD COLUMN IF NOT EXISTS approver_email text,
  ADD COLUMN IF NOT EXISTS approver_user_id uuid,
  ADD COLUMN IF NOT EXISTS approver_nome text,
  ADD COLUMN IF NOT EXISTS motivo text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS target_role text;

ALTER TABLE public.multas
  ADD COLUMN IF NOT EXISTS tribunal_nome text;

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  username text,
  nome text,
  metodo text not null default 'admin',
  status text not null default 'pending',
  resolved_by_email text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view password reset requests" ON public.password_reset_requests;
CREATE POLICY "Authenticated can view password reset requests"
  ON public.password_reset_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update password reset requests" ON public.password_reset_requests;
CREATE POLICY "Authenticated can update password reset requests"
  ON public.password_reset_requests FOR UPDATE TO authenticated USING (true);
