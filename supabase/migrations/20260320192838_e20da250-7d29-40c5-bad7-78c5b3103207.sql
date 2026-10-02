
-- Allow anonymous SELECT on agentes for username lookup during login
CREATE POLICY "Public can lookup agent by username"
ON public.agentes
FOR SELECT
TO anon
USING (true);
