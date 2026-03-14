-- Allow clients to delete their own RSVP row (anon key).
-- If RLS is enabled on rsvps with no DELETE policy, deletes silently affect 0 rows.
-- This policy allows DELETE; the app is responsible for only calling remove with the current user's phone.

DROP POLICY IF EXISTS "allow_rsvp_delete" ON rsvps;
CREATE POLICY "allow_rsvp_delete"
  ON rsvps
  FOR DELETE
  TO anon
  USING (true);
