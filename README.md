# Synq

**Intelligent group coordination for schools, clubs, and teams** — attendance,
communication, and voting in one place.

Synq is a React Native (Expo) app. **Accounts and groups/membership are now
real, backed by Supabase** (Auth + Postgres with Row Level Security). Feed,
Votes, and Attendance remain local/mock state for now.

## Getting started

```bash
npm install
```

### 1. Configure Supabase

```bash
cp .env.example .env
```

Fill `.env` with your Supabase project's values (dashboard → Project Settings →
API). Both are safe in a client app — the anon key is public and RLS protects
the data:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 2. Create the database schema

In the Supabase dashboard → **SQL Editor**, paste and run the contents of
[`supabase/schema.sql`](supabase/schema.sql). This creates the `groups` and
`memberships` tables, the RLS policies, and a helper function.

> For quick testing, you may want to disable email confirmation:
> dashboard → Authentication → Providers → Email → turn off "Confirm email".
> Otherwise sign-up requires clicking a link in your inbox before you can log in.

### 3. Run it

```bash
npm start          # then scan the QR code with Expo Go
npm run ios        # iOS simulator
npm run android    # Android emulator
```

> Requires Node 18+ and the Expo tooling (installed automatically via `npx expo`).
> The app will show a clear error at launch if the `.env` values are missing.

## What's in the skeleton

The app opens into an onboarding flow, then a bottom-tab shell with a group
detail flow.

| Area | Screen | Notes |
| --- | --- | --- |
| **Splash** | `SplashScreen` | Synq wordmark; shown while the session is restored. |
| **Welcome** | `WelcomeScreen` | One-line pitch + "Get Started". |
| **Sign up / Log in** | `AuthScreen` | **Real Supabase email + password auth**, with validation and error messages. |
| **Home** | `HomeScreen` | Greeting, quick stats, and the user's real groups. |
| **Groups** | `GroupsScreen` | Real group list (from Supabase) + "New group" → create or join. |
| **New group** | `NewGroupScreen` | Create (name + template) or Join (code / discoverable list); both add to the live groups and open the group. |
| **Alerts** | `AlertsScreen` | Mock notifications with unread state. |
| **Profile** | `ProfileScreen` | Profile card + non-functional settings rows. |
| **Group Detail** | `GroupDetailScreen` | Group header + four module cards. |

### Group modules

Tapping a group opens its detail screen, which routes into four modules:

- **Feed** — mock posts with type tag, author, text, and time.
- **Votes** — a **role-based** voting system (in-memory):
  - Each user has a permission role per group (Admin / Captain / Member),
    resolved through a swappable session layer (`src/state/session.js`).
  - **Captains and Admins** can create votes (question, 2–5 options, and a
    live-vs-hidden results toggle); the create action is hidden from Members.
  - Every member casts **one changeable vote**; ballots are **named**, so each
    voter's name shows under the option they picked.
  - **Live** votes reveal counts and names as they come in; **hidden** votes
    show only "X people have voted" to members until the creator closes them
    (the creator can preview their own hidden vote).
  - Only the **creator** can close a vote; once closed, named results are
    visible to everyone and no further votes can be cast.

  Rules live in `src/state/voteRules.js`; vote state in `src/state/votes.js`.
- **Members** — static roster of names and roles.
- **Attendance** — the app's core cascade, role-gated (in-memory):
  - **Mark attendance** (Admin/Teacher only): a `MarkAttendanceScreen` with a
    Present/Absent toggle per member and a timestamped **Submit**.
  - **Missed check-in cascade** (Captain-facing): a dev-only "Simulate missed
    check-in" button (shown under `__DEV__`) stands in for a real deadline
    timer. It fires a Captain-facing alert — *"[Teacher] hasn't checked in —
    [Group]"* — offering **Start self-study** or **Escalate to Admin**; either
    logs a status entry.
  - **History** — a read-only log for all members: timestamp, who marked it
    (or "missed — Captain self-study / escalated"), and present count.

  State in `src/state/attendance.js` (records, pending miss, history + the
  `canMarkAttendance` / `receivesCascade` rules).

## Project structure

```
App.js                     App entry (providers + navigator)
src/
  navigation/
    RootNavigator.js       Onboarding + bottom tabs + stack (detail & modules)
  screens/
    onboarding/
      SplashScreen.js
      WelcomeScreen.js
      AuthScreen.js
    HomeScreen.js
    GroupsScreen.js
    AlertsScreen.js
    ProfileScreen.js
    GroupDetailScreen.js
    modules/
      FeedScreen.js
      VotesScreen.js        List of a group's votes + gated "New vote"
      VoteDetailScreen.js   Named results, live/hidden logic, close action
      NewVoteScreen.js      Create-vote form (Captain/Admin only)
      MembersScreen.js
      AttendanceScreen.js    Cascade overview: mark action, alert, history
      MarkAttendanceScreen.js Present/Absent roll (Admin/Teacher only)
  components/               Reusable UI (Card, Avatar, Badge, Header, …)
  lib/
    supabase.js            Supabase client (configured from env vars)
  state/
    session.js             Supabase Auth session (user, signUp/signIn/signOut)
    groups.js              Supabase-backed groups/memberships (create/join, role)
    votes.js               In-memory VotesProvider (create/cast/close)
    voteRules.js           Pure tally + permission + visibility rules
    attendance.js          Attendance records, missed-check-in cascade, history
  data/
    mock.js                Groups, members, feed, alerts, current user
    votesSeed.js           Seed votes with named ballots
    discoverable.js        Create-tab group templates (type → emoji/kind)
  theme/                   Color palette, typography, spacing tokens
supabase/
  schema.sql               Tables + RLS policies (run in the SQL editor)
.env.example               Template for Supabase env vars (copy to .env)
```

## Backend (Supabase)

Real in this step: **Auth** and **groups / membership**.

- **Auth** — email + password sign-up and log-in via Supabase Auth, session
  persisted on-device (AsyncStorage) so users stay logged in. `RootNavigator`
  shows the onboarding stack when logged out and the app stack when logged in;
  Profile has a working **Log out**.
- **`groups`** — `id, name, type, created_by, created_at`.
- **`memberships`** — `user_id, group_id, role (Admin | Captain | Member),
  joined_at`, unique per (user, group).
- **Creating** a group inserts a `groups` row and an `Admin` membership for the
  creator. **Joining** (by group code = the group's id) inserts a `Member`
  membership. Home/Groups load the real groups you belong to, with your real
  role. Each group's page shows its **code** so you can invite others.
- **Row Level Security** — you can only see groups you created or belong to, and
  membership rows only for those groups. A `SECURITY DEFINER` helper
  (`is_group_member`) keeps the policies recursion-free.

> Not yet real (still local mock, unchanged): Feed, Votes, Attendance. There is
> no `profiles` table yet, so member lists can only show your own name; other
> members appear as "Group member".

## Design

A restrained, product-minded system rather than a generic dashboard template:

- **Palette** — an indigo-violet primary (`#5646C4`) with a warm coral accent
  (`#FF6B57`) on a soft cool-neutral canvas; soft semantic tints for badges.
- **Typography** — a deliberate system-font scale with tight display headings and
  spaced uppercase labels (offline-friendly, no font downloads).
- **Tokens** — spacing, radius, and shadow are centralized in `src/theme`.

## Status

Real: accounts (Supabase Auth) and groups/membership with roles + RLS. Local
mock (unchanged this step): Feed, Votes, Attendance. Next steps: a `profiles`
table for real member names, then moving Votes and Attendance onto Supabase,
plus push notifications.
