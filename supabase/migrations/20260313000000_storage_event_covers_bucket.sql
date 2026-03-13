-- Event covers bucket: public read, allow anon + authenticated to upload.
-- Run in Supabase Dashboard → SQL Editor if needed. Or create bucket in Dashboard: Storage → New bucket → Name "event-covers", Public ON, then run only the policies below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read (public bucket)
DROP POLICY IF EXISTS "Event covers are publicly readable" ON storage.objects;
CREATE POLICY "Event covers are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-covers');

-- Allow anon and authenticated to upload
DROP POLICY IF EXISTS "Anyone can upload event cover" ON storage.objects;
CREATE POLICY "Anyone can upload event cover"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'event-covers');

-- Allow upsert (overwrite existing cover)
DROP POLICY IF EXISTS "Anyone can update event cover" ON storage.objects;
CREATE POLICY "Anyone can update event cover"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'event-covers');
