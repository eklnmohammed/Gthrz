-- Gthrz public schema baseline (schema only, no table data).
--
-- Source: live linked Supabase project "Gthrz" (catalog snapshot, 2026-09-05).
-- `npx supabase db dump --linked --schema public,storage` could not run here
-- because this CLI version shells pg_dump through Docker, which is not installed.
-- This file is reconstructed from live Postgres catalog (columns, constraints,
-- indexes, RLS flags/policies, storage buckets, storage.objects policies).
--
-- Do NOT apply this to the hosted database. Do NOT run `supabase db reset`
-- against production. This file is documentation / recreate-from-zero reference.
-- Prefer `supabase/schema.sql` over a timestamped migration so the CLI will not
-- try to apply it on a database that already has these objects.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  auth_user_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_phone_key UNIQUE (phone),
  CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id)
);

COMMENT ON COLUMN public.profiles.auth_user_id IS
  'Supabase Auth user id when using OTP; null in dev/skip-OTP mode.';

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date_time timestamp with time zone NOT NULL,
  location text,
  details text,
  capacity integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  visibility text NOT NULL DEFAULT 'private'::text,
  host_phone text,
  host_name text,
  approval_required boolean DEFAULT false,
  event_type text DEFAULT 'party'::text,
  invite_code text,
  cover_key text,
  cover_url text,
  lineup jsonb,
  location_visibility text DEFAULT 'now'::text,
  location_reveal_hours integer,
  reveal_hours_before integer,
  location_name text,
  location_address text,
  location_lat double precision,
  location_lng double precision,
  show_guest_avatars boolean NOT NULL DEFAULT true,
  hide_guest_names boolean NOT NULL DEFAULT false,
  hide_guest_avatars boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'::text,
  cancellation_reason text,
  dress_code text,
  audience text,
  allow_plus_one boolean DEFAULT false,
  price_currency text,
  price_amount numeric,
  price_mode text,
  location_exact_audience text DEFAULT 'going_only'::text,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text])),
  CONSTRAINT events_event_type_check CHECK (
    event_type IS NULL
    OR (event_type = ANY (ARRAY['party'::text, 'rave'::text, 'gathering'::text, 'birthday'::text, 'dinner'::text, 'wedding'::text, 'graduation'::text]))
  ),
  CONSTRAINT events_status_check CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text])),
  CONSTRAINT events_price_amount_check CHECK (price_amount >= 0::numeric),
  CONSTRAINT events_location_exact_audience_check CHECK (
    location_exact_audience = ANY (ARRAY['all_viewers'::text, 'going_only'::text])
  )
);

COMMENT ON COLUMN public.events.show_guest_avatars IS
  'When true, event cards show who''s coming avatar overlaps; host can turn off per event.';

COMMENT ON COLUMN public.events.location_exact_audience IS
  'Who can see exact event location: all_viewers or going_only (default)';

CREATE TABLE public.rsvps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_phone text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  plus_one boolean DEFAULT false,
  declined_by_host boolean DEFAULT false,
  CONSTRAINT rsvps_pkey PRIMARY KEY (id),
  CONSTRAINT rsvps_event_id_user_phone_key UNIQUE (event_id, user_phone),
  CONSTRAINT rsvps_status_check CHECK (status = ANY (ARRAY['going'::text, 'maybe'::text, 'cant'::text, 'pending'::text])),
  CONSTRAINT rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

CREATE TABLE public.event_contributions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  title text NOT NULL,
  assigned_user_phone text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_contributions_pkey PRIMARY KEY (id),
  CONSTRAINT event_contributions_status_check CHECK (status = ANY (ARRAY['open'::text, 'done'::text])),
  CONSTRAINT event_contributions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

CREATE TABLE public.user_push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  expo_push_token text NOT NULL,
  platform text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT user_push_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

-- ---------------------------------------------------------------------------
-- Extra indexes (beyond those implied by PRIMARY KEY / UNIQUE constraints)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX events_invite_code_unique ON public.events USING btree (invite_code) WHERE (invite_code IS NOT NULL);
CREATE INDEX idx_events_event_type ON public.events USING btree (event_type);
CREATE INDEX idx_events_invite_code ON public.events USING btree (invite_code);
CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone);
CREATE INDEX idx_rsvps_event_user ON public.rsvps USING btree (event_id, user_phone);
CREATE INDEX user_push_tokens_user_phone_idx ON public.user_push_tokens USING btree (user_phone) WHERE is_active;

-- ---------------------------------------------------------------------------
-- Realtime publication (event detail subscriptions)
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_contributions;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Live policies are permissive on most public tables (anon key can read/write).
-- user_push_tokens is phone-scoped for authenticated JWT. Snapshot as-is.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert_all"
  ON public.profiles FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "profiles_update_all"
  ON public.profiles FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "events_select_public"
  ON public.events FOR SELECT TO public
  USING (true);

CREATE POLICY "events_insert_all"
  ON public.events FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "events_update_all"
  ON public.events FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "events_delete_all"
  ON public.events FOR DELETE TO public
  USING (true);

CREATE POLICY "Enable read access for all users"
  ON public.rsvps FOR SELECT TO public
  USING (true);

CREATE POLICY "rsvps_insert_all"
  ON public.rsvps FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "rsvps_update_all"
  ON public.rsvps FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "rsvps_delete_all"
  ON public.rsvps FOR DELETE TO public
  USING (true);

CREATE POLICY "allow_rsvp_delete"
  ON public.rsvps FOR DELETE TO authenticated
  USING (
    (user_phone = (auth.jwt() ->> 'phone'::text))
    OR (EXISTS (
      SELECT 1
      FROM events
      WHERE ((events.id = rsvps.event_id) AND (events.host_phone = (auth.jwt() ->> 'phone'::text)))
    ))
  );

CREATE POLICY "contributions_select_public"
  ON public.event_contributions FOR SELECT TO public
  USING (true);

CREATE POLICY "contributions_insert_all"
  ON public.event_contributions FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "contributions_update_all"
  ON public.event_contributions FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "contributions_delete_all"
  ON public.event_contributions FOR DELETE TO public
  USING (true);

CREATE POLICY "Users select own push tokens"
  ON public.user_push_tokens FOR SELECT TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'::text));

CREATE POLICY "Users insert own push tokens"
  ON public.user_push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_phone = (auth.jwt() ->> 'phone'::text));

CREATE POLICY "Users update own push tokens"
  ON public.user_push_tokens FOR UPDATE TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'::text))
  WITH CHECK (user_phone = (auth.jwt() ->> 'phone'::text));

CREATE POLICY "Users delete own push tokens"
  ON public.user_push_tokens FOR DELETE TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'::text));

-- ---------------------------------------------------------------------------
-- Storage: Gthrz buckets + object policies only (not the Storage engine tables)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars'::text);

CREATE POLICY "Public read access on avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars'::text);

CREATE POLICY "Anyone can upload avatar"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars'::text);

CREATE POLICY "Anon upload access on avatars"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'avatars'::text);

CREATE POLICY "Anyone can update avatar"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'avatars'::text);

CREATE POLICY "Anon update access on avatars"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'avatars'::text)
  WITH CHECK (bucket_id = 'avatars'::text);

CREATE POLICY "Event covers are publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-covers'::text);

CREATE POLICY "Anyone can upload event cover"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'event-covers'::text);

CREATE POLICY "Anyone can update event cover"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'event-covers'::text);
