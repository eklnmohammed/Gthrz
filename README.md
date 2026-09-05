# Gthrz

Gthrz is a privacy first mobile event planning app for creating, joining, and managing private events.

I built Gthrz as my undergraduate project, but I treated it like a production mobile app: real authentication, database-backed event state, realtime updates, and server-side notification handling.

## Why it exists

Group event planning often leaks more personal information than it needs to. Guest lists, exact addresses, and photos can spread across chats with no clear host control. Coordination also gets fragmented across WhatsApp, iMessage, and notes.

Gthrz keeps the host in control of who can see an event, who can join, when location is revealed, and what guests can see about each other.

## Key features

- **Phone OTP authentication** via Supabase Auth
- **Public, private, and invite-code** event flows
- **Host and guest** roles
- **RSVPs** for going, maybe, can’t, and pending
- **Join requests and host approvals** for events that require approval
- **Privacy controls** for guest names, avatars, capacity, plus-one, and location visibility
- **Realtime updates** on event detail screens for RSVPs, contributions, and event changes
- **Push notification support** using Expo Notifications and a Supabase Edge Function — final device delivery testing pending
- **Profile setup** with name and avatar using Supabase Storage
- **Saved / favourite events** stored locally per device

Price on an event is display only. There is no payment processing.

## Tech stack

- React Native and Expo SDK 54
- Expo Router
- TypeScript
- Supabase: PostgreSQL, Auth, Storage, and Realtime
- Supabase Edge Functions
- Expo Notifications
- EAS configuration for future native builds

## Architecture

| Path | Role |
|------|------|
| `app/` | Expo Router screens and stack navigation |
| `src/components/` | Shared UI components |
| `src/state/` | App stores for events, favourites, onboarding |
| `src/lib/` | Supabase client, auth, realtime, notifications |
| `src/theme/` | Colour, spacing, and typography constants |
| `supabase/migrations/` | Database and RLS changes |
| `supabase/functions/` | Server-side push sender |

Identity is phone based across profiles, hosts, RSVPs, and push token rows.

The notification Edge Function verifies the caller’s JWT and decides the notification recipients on the server instead of trusting the client to choose them.

## Environment setup

Copy `.env.example` to `.env` in the project root.

Required variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Use your own Supabase project. Never commit `.env`. The anon key is public by design and must be backed by Row Level Security.

Node 22 is the version in `.nvmrc`.

## Running locally

```bash
npm install
npx expo start --tunnel --go
```

Scan the QR code with **Expo Go** (SDK 54). Press `s` in Metro if it is waiting for a development build instead of Expo Go.

Typecheck:

```bash
npx tsc --noEmit
```

## Auth setup

Production login uses **Supabase Phone OTP**. Configure an SMS provider (for example Twilio) in the Supabase dashboard under Auth → Phone. Without a provider, sending a code fails by design.

**Skip OTP — demo mode** is shown only when `__DEV__` is true (Expo Go / local Metro). Release builds do not use it. Demo skip stores a local identity and does **not** create a Supabase session, so session-gated features (including push registration) do not run.

## Push notifications

Groundwork is in the client (`src/lib/notifications.ts`) and the Edge Function `send-event-notification`.

- Tokens are saved only on a **physical device** with permission granted and a valid EAS `projectId`.
- **Simulator and Expo Go** cannot fully exercise remote Expo push tokens.
- Real delivery needs a **development or production native build** on a physical device, plus the function deployed with Supabase-injected service role (never committed to git).
- Notification copy is generic (no location, names, or invite codes).

This path has **not** been fully production-tested on a physical device yet.

## Current limitations

- Real-device push delivery still needs a native build and device test
- No payments
- No automated tests yet (TypeScript check is the current gate)
- RLS and schema hardening continue as the product evolves
- No full offline mode

## Engineering focus

This project emphasises:

- **Privacy** as a product constraint, not a setting buried in the UI
- **Auth** that matches how the rest of the app identifies users (phone)
- **Realtime** so event detail stays consistent without a full app refresh
- **Defensive server-side notifications** (JWT check, server-chosen recipients, privacy-safe text)
- **Mobile UX** for hosts and guests on a single stack, without extra routing frameworks

## License

This repository is source-available for portfolio and review purposes only.

You may view the code, but you may not copy, modify, distribute, sublicense, or use it for commercial or production purposes without permission.
