# Gthrz

Privacy-first mobile event planning prototype for private social events.
Final-year project (BSc Computer Science) — built with React Native, Expo, TypeScript, and Supabase.

---

## Requirements

- Node.js 18 or 20 LTS
- npm 10+
- Xcode (for iOS Simulator) and/or Android Studio (for Android Emulator)
- Expo Go SDK 54 on a physical device (optional)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The Supabase anon key is designed to be public and is protected by row-level security policies.

---

## Install and Run

```bash
npm install
npx expo start
```

For tunnel mode (recommended if LAN does not work):

```bash
npx expo start --tunnel -c
```

Then choose one of:

- Press `i` for iOS Simulator (requires Xcode)
- Press `a` for Android Emulator (requires Android Studio)
- Scan the QR code with Expo Go SDK 54 on a physical device

---

## Demo Authentication

The verification screen includes a **Skip OTP — demo mode** button so the prototype can be evaluated without configuring a live SMS provider.

To test:

1. Enter a phone number (e.g. +966500000001).
2. On the verify screen, tap **Skip OTP — demo mode**.
3. Complete onboarding.

### Demo Test Users

| Role    | Phone Number   | Purpose                              |
| ------- | -------------- | ------------------------------------ |
| Host    | +966500000001  | Creates and manages events           |
| Guest 1 | +966500000002  | Joins events and submits RSVP        |
| Guest 2 | +966500000003  | Used for approval and capacity tests |

To test invite-code joining: create an event as Host, copy the generated invite code, then use it with a Guest account.

---

## Scope

Implemented:

- Event creation, editing, and cancellation
- Public/private visibility, approval-required RSVP, capacity, plus-one
- Privacy controls (hide guest names/avatars, exact-location audience, delayed location reveal)
- Invite-code joining (6-character codes)
- Bring-item tracking with duplicate prevention
- Local favourites and preference-signal recommendations (AsyncStorage)
- Profile editing and avatar upload (Supabase Storage)
- Partial row-level security (remaining checks in application logic)

## Limitations

- No push notifications
- No full offline mode
- No real-time updates (manual refresh required)
- No payment processing (price is display-only)
- Live SMS OTP not enabled in submitted build
- Full RLS hardening is future work

---

## Project Layout

```
app/                 Expo Router screens
src/components/      Reusable UI components
src/state/           State providers (events, favourites, onboarding)
src/lib/             Supabase client and auth
src/utils/           Helpers (invite codes, preferences, formatting)
src/theme/           Colours, spacing, typography
supabase/migrations/ SQL migrations
assets/              Icons, splash, event covers
scripts/             Build scripts
```

---

## Troubleshooting

- **Metro cache:** `npx expo start -c`
- **`.env` not picked up:** restart Metro with `npx expo start -c`
- **iOS Simulator not opening:** ensure Xcode Command Line Tools are installed
- **Android Emulator not detected:** open Android Studio, install an emulator image, retry
- **Tunnel mode:** `npx expo start --tunnel`

---

## License

Submitted as part of an undergraduate final-year project. Not licensed for production use.
