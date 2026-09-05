# Gthrz

Gthrz is a privacy-first mobile app for creating, joining, and managing private events.

I built it as my undergraduate project to bring event details, guest management, RSVPs, and invitations into one place while giving hosts more control over what guests can see.

## Features

- Phone OTP authentication with Supabase Auth
- Public, private, and invite-code event flows
- RSVPs, join requests, and host approval
- Realtime updates for event changes, RSVPs, and contributions
- Privacy controls for guest names, avatars, and location visibility
- Timed location reveal and confirmed-guest-only address access
- Capacity limits and plus-ones
- Lineups and shared bring lists
- Profile photos stored with Supabase Storage
- Device-local favourites and simple event suggestions 
- Push notification support through Expo Notifications and a Supabase Edge Function

Event prices are informational only; the app does not process payments.

## Built with

- React Native and Expo SDK 54
- Expo Router
- TypeScript
- Supabase PostgreSQL, Auth, Storage, Realtime, and Edge Functions
- Expo Notifications

## Project structure

- `app/` — screens and navigation
- `src/components/` — shared UI components
- `src/state/` — event, onboarding, and favourites state
- `src/lib/` — authentication, Supabase, realtime, and notification helpers
- `src/theme/` — colours, spacing, and typography
- `supabase/migrations/` — database and Row Level Security changes
- `supabase/functions/` — server-side push notification handling

## Running locally


Copy `.env.example` to `.env` and add credentials from your own Supabase project:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Do not commit the `.env` file. The Supabase anon key is designed for client use, but the database must still be protected with appropriate Row Level Security policies.

Install the dependencies and start Expo:

```bash
npm install
npx expo start --tunnel --go
```

The project uses Node 22. To run the TypeScript check:

```bash
npx tsc --noEmit
```

## Auth and push notes

Production login uses Supabase Phone OTP and requires an SMS provider configured in Supabase.

Local development includes a `Skip OTP — demo mode` option. It creates a local identity without a Supabase session, so session-dependent features such as push-token registration are unavailable in that mode. The shortcut is development-only and is not shown in release builds.

Push notification code is present in the client and in the `send-event-notification` Edge Function. Remote delivery requires a native development or production build, a physical device, notification permission, a valid EAS project ID, and the deployed Supabase function. Final real-device delivery testing is still pending; Expo Go and simulators cannot fully test this flow.

## Current limitations

- Push delivery has not yet been verified end to end on a physical device
- Favourites and recommendation signals are stored locally and do not sync across devices
- There is no payment integration or full offline mode
- Automated tests have not been added; TypeScript checking is the current quality gate
- Database policies and migrations should be reviewed again before a production launch

## License

This repository is source-available for portfolio and review purposes only. You may view the code, but you may not copy, modify, distribute, sublicense, or use it for commercial or production purposes without permission.

Copyright © 2026 Mohammed Ali Bin Shamlan. All rights reserved.
