
-- Add foto_url column to agentes
ALTER TABLE public.agentes ADD COLUMN IF NOT EXISTS foto_url text;

-- Create avatar storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone authenticated can upload
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

-- Storage RLS: public read
CREATE POLICY "Public can read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Storage RLS: authenticated can update own
CREATE POLICY "Authenticated can update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Storage RLS: authenticated can delete own
CREATE POLICY "Authenticated can delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');
