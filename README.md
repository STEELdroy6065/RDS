# Synq

**Intelligent group coordination for schools, clubs, and teams** — attendance,
communication, and voting in one place.

This repository currently contains a **UI-only skeleton** of the Synq mobile app,
built with React Native (Expo). It exists to validate navigation and
look-and-feel before real functionality is added. There is **no backend, database,
or auth** yet — every screen reads from mock data and holds interactions in local
component state.

## Getting started

```bash
npm install
npm start
```

Then open the project in Expo Go (scan the QR code) or run it on a simulator:

```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web       # browser
```

> Requires Node 18+ and the Expo tooling (installed automatically via `npx expo`).

## What's in the skeleton

Bottom tab navigation with four tabs, plus a group detail flow.

| Area | Screen | Notes |
| --- | --- | --- |
| **Home** | `HomeScreen` | Greeting, quick stats, and the user's groups. |
| **Groups** | `GroupsScreen` | Full group list + a visual-only "New group" stub. |
| **Alerts** | `AlertsScreen` | Mock notifications with unread state. |
| **Profile** | `ProfileScreen` | Profile card + non-functional settings rows. |
| **Group Detail** | `GroupDetailScreen` | Group header + four module cards. |

### Group modules

Tapping a group opens its detail screen, which routes into four modules:

- **Feed** — mock posts with type tag, author, text, and time.
- **Votes** — an **interactive** poll: tap an option to cast/change your vote and
  watch counts and percentages update live (in-memory only).
- **Members** — static roster of names and roles.
- **Attendance** — a visually distinct *coming soon* card; reserved space, no
  functionality yet.

## Project structure

```
App.js                     App entry (providers + navigator)
src/
  navigation/
    RootNavigator.js       Bottom tabs + stack (detail & modules)
  screens/
    HomeScreen.js
    GroupsScreen.js
    AlertsScreen.js
    ProfileScreen.js
    GroupDetailScreen.js
    modules/
      FeedScreen.js
      VotesScreen.js
      MembersScreen.js
      AttendanceScreen.js
  components/               Reusable UI (Card, Avatar, Badge, Header, …)
  data/mock.js             All placeholder content
  theme/                   Color palette, typography, spacing tokens
```

## Design

A restrained, product-minded system rather than a generic dashboard template:

- **Palette** — an indigo-violet primary (`#5646C4`) with a warm coral accent
  (`#FF6B57`) on a soft cool-neutral canvas; soft semantic tints for badges.
- **Typography** — a deliberate system-font scale with tight display headings and
  spaced uppercase labels (offline-friendly, no font downloads).
- **Tokens** — spacing, radius, and shadow are centralized in `src/theme`.

## Status

Skeleton only. Next steps (not yet implemented): authentication, a real backend,
persistent data, push notifications, and the Attendance module.
