-- Add status column to events table
-- Values: 'active' (default) | 'cancelled'

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'cancelled'));
g