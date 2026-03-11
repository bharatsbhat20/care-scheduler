# CareScheduler — Elderly Care Management System

A full-stack elderly care scheduler with web (React/Vite) and mobile (Expo/React Native) apps backed by Supabase.

## Features

- **Four roles**: Elder, Caregiver, Family, Admin
- **Medication management**: Schedules, reminders, dose logging
- **Calendar**: Appointments by type (medical, therapy, family visit, activity)
- **Tasks**: Kanban board with caregiver assignments
- **Family dashboard**: Read-only feed of care activities
- **Realtime updates**: Supabase Realtime subscriptions
- **Push notifications**: Expo Notifications (mobile)

## Project Structure

```
scheduler_v1/
├── web/          # Vite + React + TypeScript + Tailwind CSS
├── mobile/       # Expo SDK 51 + React Native + NativeWind
├── shared/       # Shared TypeScript types
└── supabase/     # SQL migrations and seed data
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration: `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. (Optional) Run `supabase/seed.sql` with real user IDs

### 2. Web App

```bash
cd web
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm install
npm run dev
```

### 3. Mobile App

```bash
cd mobile
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm install
npx expo start
```

## Environment Variables

### Web (`web/.env.local`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Mobile (`mobile/.env.local`)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extends auth.users — name, role, phone |
| `elder_profiles` | Elder-specific info: room, emergency contacts, medical notes |
| `medications` | Medication catalogue |
| `medication_schedules` | Recurring schedules with times and days |
| `medication_logs` | Dose taken/missed/skipped logs |
| `appointments` | Events with type, time, location |
| `tasks` | Caregiver tasks with priority and status |
| `task_assignments` | Many-to-many task → caregiver |
| `notification_prefs` | Per-user notification settings |
| `caregiver_elder_assignments` | Caregiver ↔ Elder links |
| `family_elder_links` | Family ↔ Elder links |

## Key Libraries

### Web
- `@supabase/supabase-js` — Backend client
- `react-router-dom` v6 — Routing
- `react-big-calendar` — Calendar view
- `@tanstack/react-query` — Data fetching/caching
- `react-hook-form` + `zod` — Forms & validation
- `lucide-react` — Icons
- `tailwindcss` — Styling

### Mobile
- `expo-router` — File-based routing
- `@supabase/supabase-js` — Backend client
- `react-native-calendars` — Calendar component
- `@tanstack/react-query` — Data fetching
- `expo-notifications` — Push notifications
- `nativewind` — Tailwind for React Native
