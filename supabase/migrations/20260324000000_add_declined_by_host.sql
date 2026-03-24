ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS declined_by_host boolean DEFAULT false;
