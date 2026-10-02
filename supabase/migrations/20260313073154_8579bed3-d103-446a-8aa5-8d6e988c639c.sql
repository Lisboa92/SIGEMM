ALTER TABLE public.agentes ADD COLUMN local_trabalho text NOT NULL DEFAULT 'via_publica';
ALTER TABLE public.agentes ADD COLUMN nivel_acesso text NOT NULL DEFAULT 'agente_campo';