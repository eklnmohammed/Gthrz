'-- Optional event_type (host may omit category). Allowed values: seven types (no engagement).
-- engagement → wedding for existing rows before tightening the CHECK.

UPDATE public.events
SET event_type = 'wedding'
WHERE event_type = 'engagement';

ALTER TABLE public.events
  ALTER COLUMN event_type DROP NOT NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check
  CHECK (
    event_type IS NULL
    OR event_type IN (
      'party',
      'rave',
      'gathering',
      'birthday',
      'dinner',
      'wedding',
      'graduation'
    )
  );
'