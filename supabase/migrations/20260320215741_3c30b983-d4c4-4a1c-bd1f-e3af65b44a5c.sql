
-- Table for cancellation requests (async flow)
CREATE TABLE public.cancel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multa_id uuid NOT NULL,
  requester_user_id uuid NOT NULL,
  requester_email text NOT NULL,
  requester_role text NOT NULL,
  approver_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.cancel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cancel requests" ON public.cancel_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cancel requests" ON public.cancel_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_user_id);
CREATE POLICY "Authenticated can update cancel requests" ON public.cancel_requests FOR UPDATE TO authenticated USING (true);
