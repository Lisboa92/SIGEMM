
CREATE OR REPLACE FUNCTION public.generate_username(p_nome text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  -- Lowercase first
  base_username := lower(trim(p_nome));
  -- Replace accented characters
  base_username := translate(base_username,
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiioooooouuuucn'
  );
  -- Replace spaces with dots
  base_username := replace(base_username, ' ', '.');
  -- Remove any non-alphanumeric/dot characters
  base_username := regexp_replace(base_username, '[^a-z0-9.]', '', 'g');
  -- Remove consecutive dots
  base_username := regexp_replace(base_username, '\.{2,}', '.', 'g');
  
  final_username := base_username;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.agentes WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  
  RETURN final_username;
END;
$$;

-- Regenerate all usernames
UPDATE public.agentes SET username = public.generate_username(nome);
