ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS agente_nome text;
UPDATE public.multas m SET agente_nome = a.nome
  FROM public.agentes a WHERE a.email = m.agente_email AND m.agente_nome IS NULL;