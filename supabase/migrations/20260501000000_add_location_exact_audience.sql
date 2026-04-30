-- Add location_exact_audience column to events table
-- Controls who can see exact location: 'all_viewers' or 'going_only' (default)
ALTER TABLE events
ADD COLUMN location_exact_audience TEXT
  CHECK (location_exact_audience IN ('all_viewers', 'going_only'))
  DEFAULT 'going_only';

COMMENT ON COLUMN events.location_exact_audience IS
  'Who can see exact event location: all_viewers or going_only (default)';
