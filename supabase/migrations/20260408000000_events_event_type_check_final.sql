-- Align events.event_type CHECK with app EventType (Create/Edit + normalizeEventType).
-- Replaces legacy constraint (e.g. events_event_type_check) that omitted `rave`.

-- 1) Backfill legacy / unknown values so the new CHECK can be applied safely.
UPDATE public.events
SET event_type = 'gathering'
WHERE event_type IN ('majlis', 'istiraha');

UPDATE public.events
SET event_type = 'rave'
WHERE event_type = 'ramadan';

UPDATE public.events
SET event_type = 'party'
WHERE event_type = 'celebration';

UPDATE public.events
SET event_type = 'party'
WHERE event_type IS NOT NULL
  AND event_type NOT IN (
    'party',
    'rave',
    'gathering',
    'birthday',
    'dinner',
    'wedding',
    'graduation',
    'engagement'
  );

-- 2) Drop existing check on event_type (name from Supabase / Postgres convention).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;

-- 3) Final allowed set (lowercase — matches app + API payloads).
ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check
  CHECK (
    event_type IN (
      'party',
      'rave',
      'gathering',
      'birthday',
      'dinner',
      'wedding',
      'graduation',
      'engagement'
    )
  );
 