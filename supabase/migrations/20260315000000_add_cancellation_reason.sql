-- Optional reason when host marks an event as cancelled (visible to guests)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
