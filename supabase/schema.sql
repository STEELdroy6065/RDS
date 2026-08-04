-- Synq — groups & memberships schema with Row Level Security.
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text,                                   -- template: class/club/community/other
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  group_id   uuid not null references public.groups (id) on delete cascade,
  role       text not null default 'Member' check (role in ('Admin', 'Captain', 'Member')),
  joined_at  timestamptz not null default now(),
  unique (user_id, group_id)
);

create index if not exists memberships_user_idx  on public.memberships (user_id);
create index if not exists memberships_group_idx on public.memberships (group_id);

-- ---------------------------------------------------------------------------
-- Helper: is the current user a member of a group?
-- SECURITY DEFINER runs as the table owner (which bypasses RLS), so using this
-- inside the policies below does NOT cause infinite RLS recursion.
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.groups      enable row level security;
alter table public.memberships enable row level security;

-- Groups: visible only to their creator or current members.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (created_by = auth.uid() or public.is_group_member(id));

-- Groups: a user may create a group only as themselves.
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert with check (created_by = auth.uid());

-- Memberships: rows are visible for groups the current user belongs to
-- (so members can be counted / listed).
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (public.is_group_member(group_id));

-- Memberships: a user may only insert a membership for themselves.
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (user_id = auth.uid());
