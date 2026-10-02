
-- Add username column to agentes
ALTER TABLE public.agentes ADD COLUMN IF NOT EXISTS username text;

-- Create function to generate username from nome
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
  -- Normalize: lowercase, replace spaces with dots, remove accents
  base_username := lower(translate(
    trim(p_nome),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ ',
    'aaaaaeeeeiiiioooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN.'
  ));
  -- Remove any non-alphanumeric/dot characters
  base_username := regexp_replace(base_username, '[^a-z0-9.]', '', 'g');
  
  final_username := base_username;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.agentes WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  
  RETURN final_username;
END;
$$;

-- Create trigger to auto-generate username
CREATE OR REPLACE FUNCTION public.auto_generate_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := public.generate_username(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_username
  BEFORE INSERT OR UPDATE ON public.agentes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_username();

-- Generate usernames for existing agents
UPDATE public.agentes SET username = public.generate_username(nome) WHERE username IS NULL OR username = '';

-- Add unique constraint
ALTER TABLE public.agentes ADD CONSTRAINT agentes_username_unique UNIQUE (username);
