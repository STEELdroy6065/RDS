-- RDS — Guardian role. Run in the Supabase SQL Editor AFTER schema.sql,
-- feed.sql, attendance.sql, attendance_v2.sql and notifications.sql.
--
-- A Guardian is a read-only 4th role: a parent/guardian linked to one student.
-- They may see the group, its announcements, and THEIR linked student's
-- attendance — and nothing else (no class chat, no votes, no other students).
--
-- Design: `is_group_member` is narrowed to real participants
-- (Admin/Captain/Member), so every existing member-only policy excludes
-- Guardians automatically. Guardians are then granted a narrow slice through
-- the additive policies below. This is deny-by-default: a new table that
-- forgets to consider guardians simply won't expose anything to them.

-- ---------------------------------------------------------------------------
-- Role + links
-- ---------------------------------------------------------------------------

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('Admin', 'Captain', 'Member', 'Guardian'));

create table if not exists public.guardian_links (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  guardian_id   uuid not null references auth.users (id) on delete cascade,
  student_id    uuid not null references auth.users (id) on delete cascade,
  student_name  text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (group_id, guardian_id, student_id)
);

create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian_id);
create index if not exists guardian_links_group_idx    on public.guardian_links (group_id);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER → bypass RLS, no recursion)
-- ---------------------------------------------------------------------------

-- NARROWED: a "member" is now a real participant, never a Guardian. Every
-- policy that uses this (posts, votes, ballots, roster, reports, attendance)
-- therefore excludes guardians with no further change.
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid()
      and role in ('Admin', 'Captain', 'Member')
  );
$$;

create or replace function public.is_group_guardian(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid() and role = 'Guardian'
  );
$$;

-- Is the caller a guardian in `gid` linked to student `sid`?
create or replace function public.guardian_of(gid uuid, sid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.guardian_links
    where group_id = gid and guardian_id = auth.uid() and student_id = sid
  );
$$;

-- ---------------------------------------------------------------------------
-- Additive guardian read access
-- ---------------------------------------------------------------------------

-- Groups: guardians can see the group row they're attached to.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (
    created_by = auth.uid()
    or public.is_group_member(id)
    or public.is_group_guardian(id)
  );

-- Memberships: everyone can see their OWN row (so a guardian's group loads);
-- participants can see the whole roster (guardians cannot — no other students).
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (
    user_id = auth.uid() or public.is_group_member(group_id)
  );

-- Posts: participants see the whole feed; guardians see Announcements only.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (
    public.is_group_member(group_id)
    or (public.is_group_guardian(group_id) and type = 'Announcement')
  );

-- Attendance records: participants + guardians (date + aggregate counts).
drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records
  for select using (
    public.is_group_member(group_id) or public.is_group_guardian(group_id)
  );

-- Attendance entries: participants see all; a guardian sees ONLY the entries
-- belonging to the student they're linked to.
drop policy if exists attendance_entries_select on public.attendance_entries;
create policy attendance_entries_select on public.attendance_entries
  for select using (
    public.is_group_member(public.attendance_record_group(record_id))
    or public.guardian_of(public.attendance_record_group(record_id), user_id)
  );

-- ---------------------------------------------------------------------------
-- Guardian links — RLS
-- ---------------------------------------------------------------------------

alter table public.guardian_links enable row level security;

-- A guardian sees their own links; a group's Admin manages all of them.
drop policy if exists guardian_links_select on public.guardian_links;
create policy guardian_links_select on public.guardian_links
  for select using (
    guardian_id = auth.uid() or public.is_group_admin(group_id)
  );

drop policy if exists guardian_links_delete on public.guardian_links;
create policy guardian_links_delete on public.guardian_links
  for delete using (public.is_group_admin(group_id));

-- Inserts go through set_guardian() below.

-- ---------------------------------------------------------------------------
-- Admin RPC: designate a member as a Guardian linked to a student.
-- Sets the guardian's membership role to 'Guardian' and creates the link.
-- ---------------------------------------------------------------------------

create or replace function public.set_guardian(
  gid uuid, guardian_uid uuid, student_uid uuid, sname text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  lid uuid;
begin
  if not public.is_group_admin(gid) then
    raise exception 'Only an Admin can link a guardian';
  end if;
  if guardian_uid = student_uid then
    raise exception 'A guardian cannot be linked to themselves';
  end if;

  -- The guardian must belong to the group; flip their role to Guardian.
  update public.memberships set role = 'Guardian'
    where group_id = gid and user_id = guardian_uid;
  if not found then
    raise exception 'That person is not a member of this group yet';
  end if;

  insert into public.guardian_links (group_id, guardian_id, student_id, student_name, created_by)
  values (gid, guardian_uid, student_uid, nullif(sname, ''), auth.uid())
  on conflict (group_id, guardian_id, student_id)
    do update set student_name = excluded.student_name
  returning id into lid;

  return lid;
end;
$$;

grant execute on function public.set_guardian(uuid, uuid, uuid, text) to authenticated;
