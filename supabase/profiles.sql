-- RDS — Profiles (real names + avatars). Run in the Supabase SQL Editor AFTER
-- schema.sql and guardian.sql (this references guardian_links).
--
-- Until now the app could only name the current user; everyone else showed as
-- "Group member". This adds a profile per user, readable by people who actually
-- share a participant group with them (and by a guardian for their linked
-- student only) — so names never leak beyond where the roster already reaches.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile on sign-up (name comes from the sign-up metadata),
-- and backfill anyone who already exists.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'name', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: does the caller share a *participant* group with `other`?
-- Guardians are excluded on both sides, so a guardian can't enumerate names
-- and other members can't read guardians this way.
-- ---------------------------------------------------------------------------

create or replace function public.shares_participant_group(other uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships them on them.group_id = me.group_id
    where me.user_id = auth.uid()
      and me.role in ('Admin', 'Captain', 'Member')
      and them.user_id = other
      and them.role in ('Admin', 'Captain', 'Member')
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Read: your own; anyone you share a participant group with; and (for a
-- guardian) the specific student you're linked to.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.shares_participant_group(id)
    or exists (
      select 1 from public.guardian_links gl
      where gl.guardian_id = auth.uid() and gl.student_id = profiles.id
    )
  );

-- Write: only your own profile.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
