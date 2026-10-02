ALTER TABLE public.multas DROP CONSTRAINT IF EXISTS multas_status_check;
ALTER TABLE public.multas ADD CONSTRAINT multas_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'paga'::text, 'cancelada'::text, 'enviada_tribunal'::text, 'fora_prazo'::text]));