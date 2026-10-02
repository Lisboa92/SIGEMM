
CREATE TABLE public.tipos_multa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'movel',
  tipo text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_multa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tipos_multa" ON public.tipos_multa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tipos_multa" ON public.tipos_multa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tipos_multa" ON public.tipos_multa FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tipos_multa" ON public.tipos_multa FOR DELETE TO authenticated USING (true);

INSERT INTO public.tipos_multa (categoria, tipo, valor) VALUES
  ('movel', 'Estacionamento proibido', 500),
  ('movel', 'Excesso de velocidade', 2000),
  ('movel', 'Semáforo vermelho', 3000),
  ('movel', 'Condução sem carta', 5000),
  ('movel', 'Falta de seguro', 2500),
  ('movel', 'Veículo sem inspecção', 1500),
  ('movel', 'Poluição sonora (veículo)', 750),
  ('imovel', 'Ocupação ilegal de passeio', 1000),
  ('imovel', 'Deposição ilegal de lixo', 1200),
  ('imovel', 'Construção sem licença', 10000),
  ('imovel', 'Falta de alvará comercial', 3000),
  ('imovel', 'Poluição sonora (estabelecimento)', 2000),
  ('imovel', 'Ocupação ilegal de terreno', 5000),
  ('imovel', 'Fachada degradada', 800);

CREATE TRIGGER update_tipos_multa_updated_at
  BEFORE UPDATE ON public.tipos_multa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
