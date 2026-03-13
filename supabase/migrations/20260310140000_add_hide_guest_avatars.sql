-- Add hide_guest_avatars flag to events
-- When true: guest users see a placeholder (e.g. person icon) instead of other guests' avatars
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hide_guest_avatars boolean NOT NULL DEFAULT false;
