-- Allow both public and private events to have an invite code
ALTER TABLE events DROP CONSTRAINT IF EXISTS public_events_no_invite_code;

-- Backfill: generate codes for existing public events that don't have one
UPDATE events
SET invite_code = upper(substr(md5(random()::text), 1, 6))
WHERE invite_code IS NULL;
