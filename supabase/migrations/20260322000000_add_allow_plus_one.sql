-- Add allow_plus_one flag to events (host setting)
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_plus_one boolean DEFAULT false;

-- Add plus_one flag to rsvps (guest toggle)
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS plus_one boolean DEFAULT false;
