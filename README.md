# Gthrz

Gthrz is a privacy-first mobile application for creating, joining, and managing events with AI-assisted planning, realtime collaboration, and fine-grained guest privacy controls.

Built with **React Native**, **Expo**, **TypeScript**, **Supabase**, and **OpenAI**, Gthrz combines secure event management, realtime collaboration, and AI-assisted event planning into a modern mobile experience while giving hosts full control over guest privacy and event visibility.

---

## Highlights

- 🤖 AI Smart Planner powered by OpenAI
- 📱 Cross-platform mobile app built with React Native & Expo
- 🔐 Phone OTP authentication with Supabase
- ⚡ Realtime synchronization using Supabase Realtime
- 📍 Fine-grained privacy and location controls
- 👥 RSVP workflow with host approval

---

# AI Smart Planner

Smart Planner is an AI-assisted event planning workflow designed to help hosts create events faster while keeping them in complete control.

Instead of automatically filling the event form, Smart Planner generates structured suggestions that appear inline beside the relevant fields. Hosts review and accept each suggestion individually before creating the event.

### Smart Planner can suggest

- Event title
- Description
- Event type
- Audience
- Privacy settings
- Dress code
- Guest capacity
- Approval requirement
- Shared bring list

### Smart Planner intentionally does **not** generate

- Dates
- Times
- Locations
- Invite codes
- Cover images
- IDs
- System-generated values

### Architecture

```text
User Prompt
      │
      ▼
Supabase Edge Function
      │
      ▼
OpenAI Responses API (GPT-5-mini)
      │
      ▼
Structured SmartPlan JSON
      │
      ▼
Inline Suggestions
      │
      ▼
Host accepts individual suggestions
```

Unlike traditional AI form generators, Smart Planner never overwrites existing user input automatically. The host always decides which suggestions to use.

---

# Screenshots


## Welcome

<p align="center">
  <img src="assets/screenshots/welcome.png" width="280">
</p>

Secure phone OTP authentication powered by Supabase Authentication.

---

## Home • Discover • Events

<p align="center">
  <img src="assets/screenshots/home.png" width="250">
  <img src="assets/screenshots/discover.png" width="250">
  <img src="assets/screenshots/events.png" width="250">
</p>

Personalized dashboard with upcoming events, public event discovery, and quick access to hosted and joined events.

---

## Event Creation

<p align="center">
  <img src="assets/screenshots/create-event.png" width="250">
  <img src="assets/screenshots/create-event-settings.png" width="250">
</p>

Create customizable events with invite codes, audience restrictions, guest visibility settings, timed location reveal, and extensive privacy controls.

---

## Event Details

<p align="center">
  <img src="assets/screenshots/event-detail.png" width="250">
  <img src="assets/screenshots/event-guests.png" width="250">
</p>

View complete event information, manage RSVPs, browse guest lists, organize shared contributions, and access schedules from a single event page.

---

## Profile

<p align="center">
  <img src="assets/screenshots/profile.png" width="280">
</p>

Manage your profile, saved events, and hosted events.

---

# Features

### Authentication

- Phone OTP authentication
- Persistent user sessions
- Invite-code event access

### AI Smart Planner

- Natural language event planning
- Structured AI suggestions
- Inline suggestion workflow
- Individual suggestion acceptance
- User-controlled editing
- OpenAI Responses API integration

### Events

- Public and private events
- RSVP workflow with host approval
- Guest capacity management
- Shared bring lists
- Event lineups
- Dress codes
- Audience selection

### Privacy

- Timed location reveal
- Guest name visibility
- Guest profile photo visibility
- Configurable event visibility

### Infrastructure

- Realtime synchronization using Supabase Realtime
- Push notification infrastructure
- AI processing with Supabase Edge Functions
- Profile photos and event covers stored with Supabase Storage

> **Note**
>
> Event prices shown in the application are informational only. Gthrz does not process payments.

---

# Technologies

### Mobile

- React Native
- Expo SDK 54
- Expo Router
- TypeScript
- React Context API

### Backend

- Supabase
  - PostgreSQL
  - Authentication
  - Storage
  - Realtime
  - Edge Functions

### AI

- OpenAI Responses API
- GPT-5-mini

### Notifications

- Expo Notifications

---

# Project Structure

```text
app/                    Screens and navigation
src/components/         Shared UI components
src/state/              Event, onboarding, and favourites state
src/lib/                Authentication, Supabase, realtime, notifications
src/theme/              Design system
supabase/functions/     Edge Functions
supabase/migrations/    Database migrations and RLS policies
```

---

# Database

The repository includes a complete database schema snapshot located at:

```text
supabase/schema.sql
```

It documents:

- Tables
- Relationships
- Constraints
- Indexes
- Storage buckets
- Realtime configuration
- Row Level Security (RLS) policies

No production data, secrets, or user information are included.

---

# Running Locally

Create a `.env` file from `.env.example`.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

To enable AI features, configure the following Supabase secret:

```text
OPENAI_API_KEY
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run start
```

Or run Expo directly:

```bash
npx expo start --tunnel --go
```

Run the TypeScript type checker:

```bash
npx tsc --noEmit
```

---

# Authentication & Notifications

Production authentication uses Supabase Phone OTP with a configured SMS provider.

For development, a **Skip OTP (Demo Mode)** option is available. It creates a local identity without a Supabase session, making it useful for UI development while disabling authenticated features.

Push notification infrastructure is implemented using Expo Notifications and Supabase Edge Functions to support event notifications and future server-side workflows.

---

# Current Limitations

- Offline mode is not currently supported.
- Payment processing is intentionally outside the project scope.
- Favourites and recommendations are currently stored locally and do not sync across devices.
- Automated tests have not yet been added.
- Additional production hardening (rate limiting, monitoring, and security refinement) is planned before public release.

---

# License

This repository is source-available for portfolio and review purposes only.

You may view the source code, but you may not copy, modify, distribute, sublicense, or use it for commercial or production purposes without prior permission.

Copyright © 2026 Mohammed Ali Bin Shamlan.

All rights reserved.