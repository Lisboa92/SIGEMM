
-- Agent messages table for in-system messaging
CREATE TABLE public.agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  sender_email TEXT NOT NULL,
  receiver_email TEXT NOT NULL,
  sender_nome TEXT,
  receiver_nome TEXT,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.agent_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages" ON public.agent_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages" ON public.agent_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- Agent login logs table
CREATE TABLE public.agent_login_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  nome TEXT,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  logout_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  local_trabalho TEXT DEFAULT 'via_publica',
  multas_registadas INTEGER DEFAULT 0,
  multas_pagas INTEGER DEFAULT 0
);

ALTER TABLE public.agent_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view login logs" ON public.agent_login_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own login logs" ON public.agent_login_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own login logs" ON public.agent_login_logs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages;
