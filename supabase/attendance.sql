-- Synq — Attendance tables + RLS. Run this in the Supabase SQL Editor.
-- (Assumes groups/memberships from schema.sql already exist.)

-- ---------------------------------------------------------------------------
-- Per-group daily check-in deadline (local "HH:MM"). The missed-check-in
-- state is computed on read by the client, not by a scheduled job.
-- ---------------------------------------------------------------------------

alter table public.groups
  add column if not exists check_in_deadline text not null default '09:00';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (id) on delete cascade,
  date            date not null,
  marked_by       uuid not null references auth.users (id) on delete cascade,
  marked_by_name  text,
  status          text not null check (status in ('submitted', 'missed_self_study', 'missed_escalated')),
  present_count   int,                                 -- for 'submitted' records
  total_count     int,
  created_at      timestamptz not null default now(),
  unique (group_id, date)                              -- one record per group per day
);

create table if not exists public.attendance_entries (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references public.attendance_records (id) on delete cascade,
  user_id      uuid,
  member_name  text,
  present      boolean not null default true
);

create index if not exists attendance_records_group_idx  on public.attendance_records (group_id);
create index if not exists attendance_entries_record_idx on public.attendance_entries (record_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS, no recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid() and role = 'Admin'
  );
$$;

create or replace function public.is_group_captain(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid() and role = 'Captain'
  );
$$;

create or replace function public.attendance_record_group(rid uuid)
returns uuid language sql security definer set search_path = public as $$
  select group_id from public.attendance_records where id = rid;
$$;

create or replace function public.owns_attendance_record(rid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.attendance_records where id = rid and marked_by = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.attendance_records enable row level security;
alter table public.attendance_entries enable row level security;

-- records: every group member can read the history.
drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records
  for select using (public.is_group_member(group_id));

-- records: only the Admin/Teacher may submit; only the Captain may resolve a
-- missed check-in (self-study / escalate). The row must be marked by the caller.
drop policy if exists attendance_records_insert on public.attendance_records;
create policy attendance_records_insert on public.attendance_records
  for insert with check (
    marked_by = auth.uid() and (
      (status = 'submitted' and public.is_group_admin(group_id))
      or (status in ('missed_self_study', 'missed_escalated') and public.is_group_captain(group_id))
    )
  );

-- entries: readable by any group member; insertable only by the record's owner
-- (the Admin who just submitted it).
drop policy if exists attendance_entries_select on public.attendance_entries;
create policy attendance_entries_select on public.attendance_entries
  for select using (public.is_group_member(public.attendance_record_group(record_id)));

drop policy if exists attendance_entries_insert on public.attendance_entries;
create policy attendance_entries_insert on public.attendance_entries
  for insert with check (public.owns_attendance_record(record_id));
