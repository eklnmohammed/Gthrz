-- Allow reading profiles by phone so event details can show avatars/names for all attendees.
-- Without this, fetchProfile(phone) returns null for users who didn't log in on this device.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable for display" ON profiles;
CREATE POLICY "Profiles are viewable for display"
  ON profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);
