# Synq

**Intelligent group coordination for schools, clubs, and teams** — attendance,
communication, and voting in one place.

Synq is a React Native (Expo) app backed by **Supabase** (Auth + Postgres with
Row Level Security). Accounts, groups/membership, votes, attendance, and the
feed are all real; every module reads and writes real data.

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

In the Supabase dashboard → **SQL Editor**, run these two files (in order):

1. [`supabase/schema.sql`](supabase/schema.sql) — `groups` + `memberships` tables and RLS.
2. [`supabase/votes.sql`](supabase/votes.sql) — `votes`, `vote_options`, `vote_ballots` tables, RLS, and helper functions.
3. [`supabase/attendance.sql`](supabase/attendance.sql) — `attendance_records`, `attendance_entries`, a per-group check-in deadline column, RLS, and helpers.
4. [`supabase/feed.sql`](supabase/feed.sql) — `posts` table and RLS.
5. [`supabase/reports.sql`](supabase/reports.sql) — `post_reports` table, RLS, and a post-delete (moderation) policy.

Each is idempotent (safe to re-run).

> **Password reset:** for the "Forgot password" deep link to return into the app,
> add the app's redirect URL to Supabase → **Authentication → URL Configuration →
> Redirect URLs** (e.g. your web preview origin with `/reset-password`, and the
> Expo dev URL). Reset behavior varies by environment (web / Expo Go / a built
> app); the screens and calls are wired regardless.

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

- **Feed** — real posts backed by **Supabase** (`posts` table). Any group
  member can create a post (Announcement / Resource / Discussion); RLS limits
  reading and posting to group members. Newest-first, with the author's name
  and a relative timestamp.
- **Votes** — a **role-based** voting system, backed by **Supabase** (real
  tables + RLS):
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

  The hidden/live/closed rules are now **enforced by RLS**, not just the UI: a
  non-creator literally cannot read the individual ballots of a hidden, open
  vote (the count comes from a member-gated SQL function). Rules live in
  `src/state/voteRules.js`; data access in `src/state/votes.js`; schema in
  `supabase/votes.sql`.
- **Members** — static roster of names and roles.
- **Attendance** — the app's core cascade, role-gated and backed by **Supabase**:
  - **Mark attendance** (Admin/Teacher only): `MarkAttendanceScreen` with a
    Present/Absent toggle per member; **Submit** writes today's record + entries.
  - **Missed check-in — computed on read, no background job**: each group has a
    daily deadline (`check_in_deadline`, default `09:00`). When the screen
    loads, if it's past the deadline and there's no record for today, the
    missed state shows. The **Captain** sees **Start self-study** / **Escalate
    to Admin** (either creates today's record); a regular member just sees
    "check-in missed, Captain notified".
  - **History** — a read-only log for all members: who marked it (or the missed
    resolution), present count, and date.

  RLS enforces the roles: only Admin/Teacher can submit, only the Captain can
  resolve a miss, all members can read. Data access in
  `src/state/attendance.js`; schema in `supabase/attendance.sql`.
  (True push for people who never open the app still needs a scheduled job —
  a later upgrade.)

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
      ForgotPasswordScreen.js
      SetNewPasswordScreen.js
    PrivacyScreen.js
    HomeScreen.js
    GroupsScreen.js
    AlertsScreen.js
    ProfileScreen.js
    GroupDetailScreen.js
    modules/
      FeedScreen.js         Supabase posts (newest first) + report action
      NewPostScreen.js      Create a post (type + text)
      ReportedPostsScreen.js  Admin/Captain moderation view
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
    votes.js               Supabase-backed VotesProvider (create/cast/close)
    voteRules.js           Pure tally + permission + visibility rules
    attendance.js          Supabase-backed attendance (lazy missed-check-in)
  data/
    mock.js                Groups, members, feed, alerts, current user
    votesSeed.js           Seed votes with named ballots
    discoverable.js        Create-tab group templates (type → emoji/kind)
  theme/                   Color palette, typography, spacing tokens
supabase/
  schema.sql               Groups + memberships tables + RLS
  votes.sql                Votes tables + RLS + helper functions
  attendance.sql           Attendance tables + deadline column + RLS
  feed.sql                 Posts table + RLS
  reports.sql              Post reports table + RLS + moderation delete
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

**Also real: Votes** (`supabase/votes.sql`) — `votes`, `vote_options`, and
`vote_ballots` tables. RLS enforces that only a group's Admin/Captain can create
a vote, only members can see or cast, only the creator can close, and the
hidden-vs-live results rule (a member-gated SQL function returns the
participation count so a hidden vote can show "X people have voted" without
exposing any ballots).

**Also real: Attendance** (`supabase/attendance.sql`) — `attendance_records`
(one per group per day) + `attendance_entries`, plus a `check_in_deadline` on
each group. The missed-check-in state is computed on read (past the deadline
with no record today), so there's no scheduled job. RLS: only Admin/Teacher can
submit, only the Captain can resolve a miss, all members can read.

**Also real: Feed** (`supabase/feed.sql`) — a `posts` table; any group member
can post (Announcement / Resource / Discussion), and RLS limits reading and
posting to members.

> There is no `profiles` table yet, so names are denormalized onto rows at write
> time; rows created by others before that exists show "Group member".

## Safety & trust

Basics for real users, in the existing visual style:

- **Password recovery** — a "Forgot password?" link on log in emails a Supabase
  reset link (`resetPasswordForEmail`); the app handles the deep link (via
  `expo-linking`) and lands on a **Set new password** screen (`updateUser`).
- **Content reporting & moderation** — every feed post has a **Report** action
  (optional reason → `post_reports`). A group's **Admin/Captain** gets a
  **Reported posts** view and can **Remove post** (RLS-gated delete). See
  `supabase/reports.sql`.
- **Privacy notice** — a plain-language `PrivacyScreen` listing what's collected
  (name, email, memberships, posts, votes, attendance) and that it's used only
  to run the app. Linked from Profile and shown as a consent line on sign-up.

## Design

A restrained, product-minded system rather than a generic dashboard template:

- **Palette** — an indigo-violet primary (`#5646C4`) with a warm coral accent
  (`#FF6B57`) on a soft cool-neutral canvas; soft semantic tints for badges.
- **Typography** — a deliberate system-font scale with tight display headings and
  spaced uppercase labels (offline-friendly, no font downloads).
- **Tokens** — spacing, radius, and shadow are centralized in `src/theme`.

## Status

Real on Supabase: accounts (Auth), groups/membership with roles + RLS, **votes**
(role-gated create/cast/close with RLS-enforced visibility), **attendance** (lazy
missed-check-in, role-gated), and **feed** (member posts). Every module is now
backed by real data. Next steps: a `profiles` table for real member names, and
push notifications (a scheduled job so the missed-check-in can reach people who
never open the app).
