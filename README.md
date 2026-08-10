# RDS

**Intelligent group coordination for schools, clubs, and teams** — attendance,
communication, and voting in one place.

RDS is a React Native (Expo) app backed by **Supabase** (Auth + Postgres with
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

In the Supabase dashboard → **SQL Editor**, run these files (in order):

1. [`supabase/schema.sql`](supabase/schema.sql) — `groups` + `memberships` tables and RLS.
2. [`supabase/votes.sql`](supabase/votes.sql) — `votes`, `vote_options`, `vote_ballots` tables, RLS, and helper functions.
3. [`supabase/attendance.sql`](supabase/attendance.sql) — `attendance_records`, `attendance_entries`, a per-group check-in deadline column, RLS, and helpers.
4. [`supabase/feed.sql`](supabase/feed.sql) — `posts` table and RLS.
5. [`supabase/reports.sql`](supabase/reports.sql) — `post_reports` table, RLS, and a post-delete (moderation) policy.
6. [`supabase/notifications.sql`](supabase/notifications.sql) — `notifications` table, RLS, and the triggers/function that populate it.
7. [`supabase/deletions.sql`](supabase/deletions.sql) — deletion controls: a `deleted` column + `delete_post()` for messages, and leave/delete-group and delete-vote RLS policies.
8. [`supabase/group_info.sql`](supabase/group_info.sql) — a group `description` column, Admin-configurable member-permission toggles (post / invite / view members), a `groups` update policy, and server-side enforcement of the "members can post" toggle.
9. [`supabase/attachments.sql`](supabase/attachments.sql) — attachment columns on `posts`, and a public `attachments` Storage bucket (authenticated upload, public read) for images and files shared in the feed.

Each is idempotent (safe to re-run).

#### Optional: the AI features (Catch me up + Home assistant)

Two AI features run through **Edge Functions** that call an AI **server-side** —
so the API key never ships in the app bundle: the Feed's **Catch me up**
([catch-me-up](supabase/functions/catch-me-up/index.ts)) summary, and the **AI
assistant** on Home ([assistant](supabase/functions/assistant/index.ts)) — the
sparkle button in the search bar, a conversational panel that answers using your
real data (groups, open votes, today's attendance, recent feed), drafts
messages, and can **search** your feed messages, shared files, votes and people
(a `search_rds` tool the model calls server-side, RLS-scoped to your groups).
Both are optional; the rest of the app works without them, and both read
whichever provider secret you set. You need the
[Supabase CLI](https://supabase.com/docs/guides/cli).

**Free option — Groq** (free, no billing, no region limits). Get a key at
[console.groq.com/keys](https://console.groq.com/keys), then:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # from supabase.com/dashboard/account/tokens
npx supabase secrets set GROQ_API_KEY=gsk_... --project-ref <your-project-ref>
npx supabase functions deploy catch-me-up --project-ref <your-project-ref>
npx supabase functions deploy assistant  --project-ref <your-project-ref>
```

The secret is project-wide, so both functions share it — you set the key once
and deploy each function.

**Other providers** — set one of these secrets instead:
`GEMINI_API_KEY` (Google Gemini, free tier where available) or `ANTHROPIC_API_KEY`
(Claude, paid). If several are set the priority is Groq → Gemini → Claude. Model
overrides: `GROQ_MODEL` (default `llama-3.3-70b-versatile`), `GEMINI_MODEL`
(default `gemini-2.0-flash`), `ANTHROPIC_MODEL` (default
`claude-3-5-haiku-latest`). Until the function is deployed, the button just shows
a friendly "unavailable" message.

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

The app opens into an onboarding flow, then a **Replit-inspired shell**: a
persistent left **group rail** (`GroupRail`) for switching groups, and a clean
main view with **no bottom tab bar**. Home is the default; Alerts is reached
via the header bell, and Profile / account settings via the header avatar menu.

| Area | Screen | Notes |
| --- | --- | --- |
| **Splash** | `SplashScreen` | RDS wordmark; shown while the session is restored. |
| **Welcome** | `WelcomeScreen` | One-line pitch + "Get Started". |
| **Sign up / Log in** | `AuthScreen` | **Real Supabase email + password auth**, with validation and error messages. |
| **Group rail** | `GroupRail` | Always-visible vertical rail of circular group icons, ringed by your role; tap to jump into a group, `+` to create/join. |
| **Home** | `HomeScreen` | Header (RDS wordmark, bell with unread badge, avatar menu), centered greeting, a real **search** (groups, feed messages, shared files, votes, people — each tappable), an **AI assistant** button, and the user's real groups. |
| **Alerts** | `AlertsScreen` | Real in-app notifications (Supabase); reached from the Home bell; unread dot + badge; tap marks read and jumps to the vote/feed/attendance/reports. |
| **New group** | `NewGroupScreen` | Create (name + template) or Join (**scan a QR** / enter a code); both add to the live groups and open the group. |
| **Scan group** | `ScanGroupScreen` | Camera QR scanner (`expo-camera`) — scan a group's QR to join. |
| **Alerts** | `AlertsScreen` | Mock notifications with unread state. |
| **Profile** | `ProfileScreen` | Profile card + non-functional settings rows. |
| **Group Detail** | `GroupDetailScreen` | Group header + four module cards. |

### Group modules

Tapping a group opens its detail screen, which routes into four modules:

- **Feed** — a real **chat** backed by **Supabase** (`posts` table): message
  bubbles (yours right-aligned, others left with avatar + name), a fixed
  bottom input bar to send, and a distinct highlighted **Announcement** bubble
  (Admin/Captain can toggle the megaphone to broadcast one). Long-press a
  message to report it. RLS limits reading and posting to group members.
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
    RootNavigator.js       Onboarding + group-rail shell (Home/Alerts/Profile) + stack
  components/
    GroupRail.js           Discord-style vertical group switcher
    AvatarMenu.js          Header avatar dropdown (Profile + account settings)
    …                      Card, Avatar, RoleBadge, Pulse, Header, …
  screens/
    onboarding/
      SplashScreen.js
      WelcomeScreen.js
      AuthScreen.js
      ForgotPasswordScreen.js
      SetNewPasswordScreen.js
    PrivacyScreen.js
    HomeScreen.js
    AlertsScreen.js
    ProfileScreen.js
    GroupDetailScreen.js
    modules/
      FeedScreen.js         Chat (bubbles + input bar + announcements)
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
  notifications.sql        Notifications table + RLS + triggers/function
  deletions.sql            Soft-delete messages + leave/delete policies
  group_info.sql           Group description + member permission toggles
  attachments.sql          Post attachment columns + Storage bucket + policies
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
  creator. **Joining** inserts a `Member` membership — by **scanning the group's
  QR code** (the group id, via `expo-camera`) or by entering the code manually.
  Each group's page shows a **QR code** (rendered with `react-native-qrcode-svg`)
  to invite others. Home/Groups load the real groups you belong to, with your
  real role.
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

**Also real: Feed** (`supabase/feed.sql`, `supabase/attachments.sql`) — a
`posts` table; any group member can post (Announcement / Resource / Discussion),
and RLS limits reading and posting to members. Messages can carry an
**attachment** — an image (from the photo library or camera) or a file (via the
document picker) — uploaded to a public Supabase **Storage** bucket and rendered
inline (image thumbnail, or a tappable file chip). Shared images also surface in
the group's **Media & links** tab. When a member returns to a busy chat with a
backlog (more than ~10 unread), a **Catch me up** button offers a one-tap AI
summary (3-5 sentences) of what they missed — generated by the optional
`catch-me-up` Edge Function so the AI key stays server-side.

**Also real: Notifications** (`supabase/notifications.sql`) — a `notifications`
table populated **server-side by triggers**: a new vote or a new Announcement
notifies every group member; a report notifies the group's Admins/Captains. The
missed check-in (computed on read, no cron) is raised via a `SECURITY DEFINER`
function the app calls when it observes the miss, deduped to once per group per
day. RLS: you only see/update your own notifications; inserts come only from the
triggers/function. The Alerts screen and the tab's unread badge read from it.

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

## Deletion & removal

Role-aware controls (`supabase/deletions.sql`):

- **Groups** — any member can **Leave** (removes their own membership); only the
  **Admin** can **Delete** the whole group, which cascades away all its posts,
  votes, attendance, memberships, and notifications. Both live in the group's
  settings section with clear confirmations.
- **Messages** — **WhatsApp-style soft delete**: the author, or a group
  **Admin/Captain** (moderation), can delete a message via long-press → it's
  replaced by a "This message was deleted" placeholder rather than vanishing.
  Enforced by a `SECURITY DEFINER` `delete_post()` function.
- **Votes** — the vote's **creator** or the group's **Admin/Captain** can delete
  a vote entirely (open or closed), removing all cast ballots with it.

## Design

A clean, **professional monochrome** look — white canvas, near-black ink,
restrained grays, and black as the primary "brand" color. Color is used
sparingly and only where it means something. The goal is a calm, business-like
product, not a flashy one.

- **Monochrome base** (`src/theme/colors.js`) — a white canvas (`#FFFFFF`),
  near-black text (`#15161B`), a light gray fill (`#F3F3F5`) for inputs, chips
  and icon tiles, and thin `#E7E7EB` borders for definition instead of heavy
  shadows. The only chromatic accent is a single red (`#CF3B2E`), reserved for
  destructive/attention states (sign out, reports, an escalated check-in).
- **Grayscale roles** (`src/theme/roles.js`) — role is still a visual signal,
  now expressed as **weight** rather than hue: Admin reads darkest, Captain
  mid-gray, Member lightest, on avatar rings, badges (`RoleBadge`) and the group
  rail.
- **Black headers** — key surfaces (e.g. the Profile identity header) use a
  solid black band with white text, echoing a clean utility-app layout.
- **Shape & spacing** — modest corner radii and plain, functional spacing;
  no oversized pills or glow.
- **Signal dot** (`src/components/Pulse.js`) — a small static dot marks unread
  items (alerts, live votes) — quiet, not animated.
- **Icons** — a single family (Ionicons), thin line/outline style in gray for a
  clean, consistent list-driven look.
- **Foundations** — a deliberate system-font scale, tokens centralized in
  `src/theme` so the whole app re-themes by flipping the palette.

## Status

Real on Supabase: accounts (Auth), groups/membership with roles + RLS, **votes**
(role-gated create/cast/close with RLS-enforced visibility), **attendance** (lazy
missed-check-in, role-gated), and **feed** (member posts). Every module is now
backed by real data. Next steps: a `profiles` table for real member names, and
push notifications (a scheduled job so the missed-check-in can reach people who
never open the app).
