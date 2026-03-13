-- Add hide_guest_names flag to events
-- When true: guest users see avatars/initials but not names in the guest list
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hide_guest_names boolean NOT NULL DEFAULT false;
