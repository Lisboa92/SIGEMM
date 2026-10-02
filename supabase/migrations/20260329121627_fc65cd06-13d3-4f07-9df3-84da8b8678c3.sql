
CREATE TABLE public.locais_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.locais_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view locais_pagamento" ON public.locais_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert locais_pagamento" ON public.locais_pagamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update locais_pagamento" ON public.locais_pagamento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete locais_pagamento" ON public.locais_pagamento FOR DELETE TO authenticated USING (true);

-- Seed default locations
INSERT INTO public.locais_pagamento (nome) VALUES
  ('Balcão Único do CMM - Sede'),
  ('Direcção de Finanças - Matola'),
  ('Posto de Atendimento - Machava'),
  ('Posto de Atendimento - T3'),
  ('Banco BCI - Agência Matola'),
  ('M-Pesa / e-Mola (Ref. na factura)');
