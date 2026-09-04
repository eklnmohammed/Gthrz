-- Push notification device tokens for Expo push delivery.
--
-- Design note: this app identifies users by phone everywhere (profiles, rsvps.user_phone,
-- events.host_phone) and existing RLS uses (auth.jwt() ->> 'phone'). To stay consistent we
-- key push tokens by user_phone instead of auth.users(id). The service role (used by the
-- send-event-notification Edge Function) bypasses RLS, so it can read every token to send.
--
-- One row per device: expo_push_token is UNIQUE so re-registering the same device upserts
-- in place. (Re-using one physical device across two different beta accounts is a rare edge
-- case; RLS scopes updates to the owning phone, so a stale row is just left inactive rather
-- than crashing the client.)

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone text NOT NULL,
  expo_push_token text NOT NULL UNIQUE,
  platform text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_phone_idx
  ON public.user_push_tokens (user_phone)
  WHERE is_active;

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users may only see and manage their own device tokens. Identity = phone claim in the JWT,
-- matching the rest of the schema. The service role bypasses RLS and is used for sending.

DROP POLICY IF EXISTS "Users select own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users select own push tokens"
  ON public.user_push_tokens
  FOR SELECT
  TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'));

DROP POLICY IF EXISTS "Users insert own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users insert own push tokens"
  ON public.user_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_phone = (auth.jwt() ->> 'phone'));

DROP POLICY IF EXISTS "Users update own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users update own push tokens"
  ON public.user_push_tokens
  FOR UPDATE
  TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'))
  WITH CHECK (user_phone = (auth.jwt() ->> 'phone'));

DROP POLICY IF EXISTS "Users delete own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users delete own push tokens"
  ON public.user_push_tokens
  FOR DELETE
  TO authenticated
  USING (user_phone = (auth.jwt() ->> 'phone'));
