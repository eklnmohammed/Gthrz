-- Allow anyone (anon) to read events that are public.
-- Run this in Supabase Dashboard → SQL Editor if Discover doesn't show public events.
-- Only run if Row Level Security (RLS) is already enabled on `events`; otherwise
-- enable it first and ensure you have a policy so hosts can still read their own events.
-- To enable RLS: ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
CREATE POLICY "Public events are viewable by everyone"
  ON events
  FOR SELECT
  TO anon
  USING (visibility = 'public');
