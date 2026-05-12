# Gthrz

Privacy-first mobile event planning prototype for private social events.
Final-year project (BSc Computer Science) — built with React Native, Expo, TypeScript, and Supabase.

This repository contains the submitted prototype. See the project report for full design, evaluation, and limitations.

---

## Requirements

- Node.js 18 or 20 LTS (use the version pinned in `.nvmrc` if available)
- npm 10+ (project uses `package-lock.json`)
- A recent version of Xcode (iOS Simulator) and/or Android Studio (Android Emulator)
- Expo Go SDK 54 on a physical device is also supported

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Notes:

- `EXPO_PUBLIC_*` variables are intentionally exposed to the client bundle — the Supabase **anon** key is designed to be public and is gated by row-level security policies.
- If `.env` is missing the app will throw a clear startup error explaining which variables are missing.

---

## Install and run

```bash
npm install
npx expo start
```

Then, in the Expo developer menu, choose one of:

- `i` to launch the **iOS Simulator** (requires Xcode)
- `a` to launch the **Android Emulator** (requires Android Studio)
- Scan the QR code with **Expo Go SDK 54** on a physical iOS or Android device. The app is a managed Expo project and does not require a custom development build.

Useful alternatives:

```bash
npm run ios          # opens the iOS Simulator directly
npm run android      # opens the Android Emulator directly
npm run start:tunnel # use ngrok tunnel if LAN does not work
```

---

## Demo authentication (Skip OTP)

The verification screen includes a clearly labelled **Skip OTP — demo mode** button.
This is provided so the prototype can be evaluated **without configuring a live SMS provider** in Supabase. In production, the system uses Supabase Phone OTP (`supabase.auth.signInWithOtp` / `verifyOtp`) as documented in the report.

To evaluate the app quickly:

1. Enter any phone number (e.g. your own with country code).
2. On the verify screen, tap **Skip OTP — demo mode**.
3. Continue onboarding to create your profile.

---

## What is in scope

This is a functional prototype. The following are implemented and tested:

- Event creation, editing, and cancellation
- Public/private visibility, approval-required RSVP, capacity, plus-one
- Privacy controls: hide guest names, hide guest avatars, exact-location audience, delayed location reveal
- Invite-code joining (6-character alphanumeric codes)
- Bring-item / contribution tracking with duplicate prevention
- Local favourites and a local preference-signal recommendation surface (AsyncStorage)
- Profile editing and avatar upload to Supabase Storage
- Custom top bars and a custom bottom navigation bar
- Partial Supabase row-level security; remaining checks (capacity, host-only actions, approval) live in application logic

## What is out of scope (prototype limitations)

- Push notifications
- Full offline mode
- Real-time updates (manual refresh required)
- Payment processing (price is display-only)
- Full production hardening of row-level security
- Live SMS OTP verification in the submitted build (demo skip is used for evaluation)

---

## Project layout

```
app/                Expo Router screens (onboarding, events, profile, discover, ...)
src/components/     Reusable UI components and event-form sub-sections
src/state/          EventsProvider, FavoritesProvider, OnboardingStore
src/lib/            Supabase client, auth (OTP + dev mode)
src/utils/          Helpers (invite codes, preferences, formatting, ...)
src/theme/          Colours, spacing, radius, typography
supabase/migrations/ Versioned SQL migrations
assets/             Icons, splash, generated event cover images
scripts/            Cover/icon generation scripts (run via npm scripts)
```

---

## Troubleshooting

- **Metro cache issues:** `npx expo start -c` (clear cache).
- **`.env` not picked up:** restart Metro with `npx expo start -c`.
- **iOS Simulator not opening:** ensure Xcode is installed and Command Line Tools are selected.
- **Android Emulator not detected:** open Android Studio at least once, install an emulator image, then retry.
- **Tunnel mode required (different networks):** `npm run start:tunnel`.

---

## License

Submitted as part of an undergraduate final-year project. Not licensed for production use.



## Demo test users

The prototype can be tested using demo mode. On the verification screen, enter one of the following test phone numbers, then tap **Skip OTP — demo mode**.

| Role | Phone number | Purpose |
|---|---|---|
| Host | +966500000001 | Creates and manages test events |
| Guest 1 | +966500000002 | Joins events using invite code and submits RSVP |
| Guest 2 | +966500000003 | Used for approval/decline and capacity testing |

Example invite code for a prepared test event:

```text
ABC123```
```
