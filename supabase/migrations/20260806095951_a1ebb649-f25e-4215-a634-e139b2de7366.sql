ALTER TABLE public.multas
  ADD COLUMN IF NOT EXISTS assinatura_infrator text,
  ADD COLUMN IF NOT EXISTS assinatura_agente text,
  ADD COLUMN IF NOT EXISTS assinado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS offline_sync boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_multas_infrator_documento ON public.multas (infrator_documento);
CREATE INDEX IF NOT EXISTS idx_multas_matricula ON public.multas (matricula);