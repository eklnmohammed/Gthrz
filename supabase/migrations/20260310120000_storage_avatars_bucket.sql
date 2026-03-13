-- Avatars bucket: public read, allow anon + authenticated to upload (for dev and prod).
-- Run in Supabase Dashboard → SQL Editor. If INSERT fails (e.g. no permission), create the bucket
-- in Dashboard: Storage → New bucket → Name "avatars", set Public ON, then run only the policies below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read (public bucket; anon + authenticated)
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Allow anon and authenticated to upload (dev mode uses anon)
DROP POLICY IF EXISTS "Anyone can upload avatar" ON storage.objects;
CREATE POLICY "Anyone can upload avatar"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Allow upsert (update existing avatar)
DROP POLICY IF EXISTS "Anyone can update avatar" ON storage.objects;
CREATE POLICY "Anyone can update avatar"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'avatars');
