
-- Agent presence tracking
CREATE TABLE public.agent_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  nome text,
  local_trabalho text DEFAULT 'via_publica',
  latitude double precision,
  longitude double precision,
  last_seen timestamp with time zone DEFAULT now(),
  is_online boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.agent_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presence" ON public.agent_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upsert own presence" ON public.agent_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presence" ON public.agent_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presence" ON public.agent_presence FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  action text NOT NULL,
  resource_id uuid,
  local_trabalho text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Notification read tracking
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads" ON public.notification_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reads" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for presence and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
