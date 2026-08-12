-- RDS — Timetable (recurring weekly sessions). Run in the Supabase SQL Editor
-- AFTER schema.sql, votes.sql and guardian.sql (uses is_group_admin_or_captain
-- and is_group_guardian). A teacher adds a session once (a weekday + time); it
-- shows on every member's Week timeline.

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  title       text not null,
  weekday     int not null check (weekday between 0 and 6),   -- 0 = Sunday … 6 = Saturday
  start_time  text not null,                                   -- local "HH:MM"
  location    text,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_group_idx on public.sessions (group_id, weekday, start_time);

alter table public.sessions enable row level security;

-- Read: any group member (guardians included, so they see their student's week).
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions
  for select using (
    public.is_group_member(group_id) or public.is_group_guardian(group_id)
  );

-- Write: only an Admin/Captain of the group.
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions
  for insert with check (
    created_by = auth.uid() and public.is_group_admin_or_captain(group_id)
  );

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions
  for update using (public.is_group_admin_or_captain(group_id))
  with check (public.is_group_admin_or_captain(group_id));

drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions
  for delete using (public.is_group_admin_or_captain(group_id));
