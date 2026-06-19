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

For marking, a `.env` file may be included with the submitted ZIP so the prototype can connect to the Supabase test project.

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

1. Enter a phone number (e.g. +44500000001).
2. On the verify screen, tap **Skip OTP — demo mode**.
3. Complete onboarding.

Supabase Phone OTP is the intended authentication method for production.

### Demo Test Users

The app can be tested with any phone number in demo mode. The following numbers already have sample data in the Supabase project:

| Role | Phone Number | Purpose |
|---|---|---|
| Host / sample user | +4411111111 | Can be used to view public events and some existing created/joined events. |
| Main host user | +4499999999 | Main demo account used to create most of the sample events. Useful for testing host features. |
| Guest user | +4422222222 | Simple guest account for testing joining, RSVP, and guest-side flows. |

To test the app from a fresh account, enter any new phone number and use **Skip OTP — demo mode**.

To test host features quickly, use **+4499999999**. To test guest features, use **+4422222222**. To test invite-code joining, create an event as the host, copy the generated six-character invite code, then join using a guest account.


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
- **Tunnel mode:** `npx expo start --tunnel -c`

---

## License

Submitted as part of an undergraduate final-year project. Not licensed for production use.
