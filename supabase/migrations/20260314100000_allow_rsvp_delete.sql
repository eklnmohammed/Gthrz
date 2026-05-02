-- Allow authenticated users to delete their own RSVP row,
-- or hosts to delete RSVPs for events they own.

DROP POLICY IF EXISTS "allow_rsvp_delete" ON rsvps;
CREATE POLICY "allow_rsvp_delete"
  ON rsvps
  FOR DELETE
  TO authenticated
  USING (
    user_phone = (auth.jwt() ->> 'phone')
    OR EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = rsvps.event_id
        AND events.host_phone = (auth.jwt() ->> 'phone')
    )
  );
