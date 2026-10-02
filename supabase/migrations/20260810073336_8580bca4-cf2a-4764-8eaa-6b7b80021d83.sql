CREATE TABLE public.reclamacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multa_id uuid REFERENCES public.multas(id) ON DELETE SET NULL,
  multa_numero text,
  reclamante_nome text NOT NULL,
  reclamante_documento text,
  reclamante_contacto text,
  motivo text NOT NULL,
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','deferida','indeferida')),
  resposta text,
  respondido_por_email text,
  respondido_em timestamptz,
  criado_por uuid,
  criado_por_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reclamacoes TO authenticated;
GRANT ALL ON public.reclamacoes TO service_role;

ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reclamacoes" ON public.reclamacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert reclamacoes" ON public.reclamacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update reclamacoes" ON public.reclamacoes FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_reclamacoes_updated_at BEFORE UPDATE ON public.reclamacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reclamacoes_status ON public.reclamacoes(status);
CREATE INDEX idx_reclamacoes_multa ON public.reclamacoes(multa_id);