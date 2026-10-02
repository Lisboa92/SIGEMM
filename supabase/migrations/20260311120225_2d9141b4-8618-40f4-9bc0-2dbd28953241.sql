
-- Create storage bucket for multa photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('multa-fotos', 'multa-fotos', true);

-- RLS policies for multa-fotos bucket
CREATE POLICY "Authenticated users can upload multa photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'multa-fotos');

CREATE POLICY "Anyone can view multa photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'multa-fotos');

CREATE POLICY "Authenticated users can delete own multa photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'multa-fotos');

-- Add fotos column to multas table (array of photo URLs)
ALTER TABLE public.multas ADD COLUMN fotos text[] DEFAULT '{}';
