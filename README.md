# Gthrz

Gthrz is a privacy-first mobile app for creating, joining, and managing private events.

I built Gthrz as my undergraduate capstone project to explore secure mobile event management using React Native, Expo, and Supabase. The app brings event details, guest management, RSVPs, and invitations into one place while giving hosts more control over what guests can see.

---

## Screenshots

### Authentication & Discovery

| Welcome | Home | Discover |
|---------|------|----------|
| ![Gthrz welcome screen](assets/screenshots/welcome.png) | ![Gthrz home screen](assets/screenshots/home.png) | ![Gthrz discover screen](assets/screenshots/discover.png) |
| Secure phone OTP authentication | Personalized event dashboard | Browse public events with search |

### Event Creation & Privacy

| Events | Create Event | Privacy Controls |
|--------|--------------|------------------|
| ![Gthrz events screen](assets/screenshots/events.png) | ![Gthrz create event screen](assets/screenshots/create-event.png) | ![Gthrz privacy controls](assets/screenshots/create-event-settings.png) |
| Manage hosted and joined events | Create customizable events | Control guest visibility and location privacy |

### Event Experience

| Event Details | Guests & Planning | Profile |
|--------------|-----------------|---------|
| ![Gthrz event detail](assets/screenshots/event-detail.png) | ![Gthrz guests and planning](assets/screenshots/event-guests.png) | ![Gthrz profile](assets/screenshots/profile.png) |
| Event details and RSVP management | Guests, contributions, and schedule | User profile and saved events |

---

## Features

- Phone OTP authentication with Supabase Auth
- Public, private, and invite-code event flows
- RSVPs, join requests, and host approval
- Realtime updates for event changes, RSVPs, and contributions
- Privacy controls for guest names, avatars, and location visibility
- Timed location reveal and confirmed-guests-only address access
- Capacity limits and plus-ones
- Lineups and shared bring lists
- Profile photos stored with Supabase Storage
- Device-local favourites and lightweight event recommendations
- Push notification infrastructure using Expo Notifications and a Supabase Edge Function

> **Note**
>
> Event prices are informational only. Gthrz does not process payments.

---

## Architecture

- Expo Router for navigation
- React Context for global state management
- Supabase Authentication (Phone OTP)
- PostgreSQL with Row Level Security (RLS)
- Supabase Realtime subscriptions
- Expo Notifications
- Supabase Edge Functions

---

## Built With

- React Native
- Expo SDK 54
- Expo Router
- TypeScript
- Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- Expo Notifications

---

## Project Structure

```text
app/                    Screens and navigation
src/components/         Shared UI components
src/state/              Event, onboarding, and favourites state
src/lib/                Authentication, Supabase, realtime, notifications
src/theme/              Design system
supabase/functions/     Edge Functions
supabase/migrations/    Database migrations and RLS changes
```

---

## Database Schema

The repository includes a schema snapshot in:

```
supabase/schema.sql
```

It documents the current tables, indexes, constraints, storage buckets, realtime configuration, and Row Level Security policies.

No user data, phone numbers, secrets, or production credentials are included.

---

## Running Locally

Copy `.env.example` to `.env` and configure your own Supabase project.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Install dependencies:

```bash
npm install
```

Start the project:

```bash
npx expo start --tunnel --go
```

Type-check:

```bash
npx tsc --noEmit
```

---

## Authentication & Push Notifications

Production authentication uses Supabase Phone OTP with an SMS provider (Twilio).

For development, a **Skip OTP (Demo Mode)** shortcut is available. It creates a local identity without a Supabase session, making it suitable for UI development but not for testing authenticated features.

Push notification infrastructure has been implemented using Expo Notifications and a Supabase Edge Function.

End-to-end push delivery requires:

- a native development or production build
- a physical device
- notification permission
- a configured EAS project
- a deployed Edge Function

---

## Current Limitations

- Push notifications have not yet been verified end-to-end on a physical device.
- Favourites and recommendation signals are stored locally and do not sync across devices.
- Offline mode is not currently supported.
- Payment processing has not been implemented.
- Automated tests have not yet been added.
- Database policies will be further tightened before a production release.

---

## License

This repository is source-available for portfolio and review purposes only.

You may view the code, but you may not copy, modify, distribute, sublicense, or use it for commercial or production purposes without permission.

Copyright © 2026 Mohammed Ali Bin Shamlan.
All rights reserved.