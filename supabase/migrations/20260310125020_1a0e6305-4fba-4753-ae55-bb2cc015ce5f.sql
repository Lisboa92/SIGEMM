
CREATE TABLE public.agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefone text,
  numero_agente text NOT NULL UNIQUE,
  cargo text NOT NULL DEFAULT 'agente',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agentes"
  ON public.agentes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agentes"
  ON public.agentes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agentes"
  ON public.agentes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete agentes"
  ON public.agentes FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_agentes_updated_at
  BEFORE UPDATE ON public.agentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
