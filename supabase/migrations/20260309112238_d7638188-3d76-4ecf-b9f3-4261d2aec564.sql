
-- Create multas table
CREATE TABLE public.multas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  agente_id UUID NOT NULL,
  agente_email TEXT,
  infrator_nome TEXT NOT NULL,
  infrator_documento TEXT,
  matricula TEXT,
  infracao_tipo TEXT NOT NULL,
  local TEXT NOT NULL,
  observacoes TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'cancelada')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  resource_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Multas policies
CREATE POLICY "Authenticated users can view all multas"
  ON public.multas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create multas"
  ON public.multas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = agente_id);

CREATE POLICY "Authenticated users can update their own multas"
  ON public.multas FOR UPDATE TO authenticated
  USING (auth.uid() = agente_id);

-- Audit log policies
CREATE POLICY "Authenticated users can view audit logs"
  ON public.audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create audit logs"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_multas_agente ON public.multas(agente_id);
CREATE INDEX idx_multas_status ON public.multas(status);
CREATE INDEX idx_multas_created ON public.multas(created_at DESC);
CREATE INDEX idx_audit_user ON public.audit_log(user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_multas_updated_at
  BEFORE UPDATE ON public.multas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
