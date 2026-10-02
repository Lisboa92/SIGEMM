DROP POLICY IF EXISTS "Authenticated users can update their own multas" ON public.multas;
CREATE POLICY "Users can update own multas or supervisors update any" ON public.multas
FOR UPDATE TO authenticated
USING (
  auth.uid() = agente_id
  OR EXISTS (
    SELECT 1 FROM public.agentes a
    WHERE a.email = (auth.jwt() ->> 'email')
      AND a.nivel_acesso IN ('supervisor','admin')
  )
);