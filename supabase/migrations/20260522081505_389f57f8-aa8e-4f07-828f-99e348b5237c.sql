
ALTER TABLE public.multas
  ADD COLUMN IF NOT EXISTS numero_auto text,
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS foto_documento text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS comprovativo_url text,
  ADD COLUMN IF NOT EXISTS referencia_deposito text,
  ADD COLUMN IF NOT EXISTS local_pagamento text,
  ADD COLUMN IF NOT EXISTS dimensoes text,
  ADD COLUMN IF NOT EXISTS estagio_obra text,
  ADD COLUMN IF NOT EXISTS descricao_imovel text,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'movel';

CREATE UNIQUE INDEX IF NOT EXISTS multas_numero_auto_unique
  ON public.multas (numero_auto) WHERE numero_auto IS NOT NULL;

CREATE INDEX IF NOT EXISTS multas_status_idx ON public.multas (status);
CREATE INDEX IF NOT EXISTS multas_categoria_idx ON public.multas (categoria);

-- Função para marcar multas pendentes fora do prazo (15 dias)
CREATE OR REPLACE FUNCTION public.marcar_multas_fora_prazo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.multas
  SET status = 'fora_prazo', updated_at = now()
  WHERE status = 'pendente'
    AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
