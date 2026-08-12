-- RDS — Portable record verification. Run in the Supabase SQL Editor AFTER
-- schema.sql, attendance.sql, attendance_v2.sql and guardian.sql.
--
-- A student's participation record is computed on read from attendance. What
-- makes it *portable* is a school signature: an Admin/Captain verifies the
-- record, and that verification travels with the student. This adds the
-- verification store + an RPC to sign one.

create table if not exists public.record_verifications (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references public.groups (id) on delete cascade,
  student_id        uuid not null references auth.users (id) on delete cascade,
  verified_by       uuid references auth.users (id) on delete set null,
  verified_by_name  text,
  note              text,
  verified_at       timestamptz not null default now()
);

create index if not exists record_verifications_lookup_idx
  on public.record_verifications (group_id, student_id, verified_at desc);

alter table public.record_verifications enable row level security;

-- Readable by: the student themselves; the group's participants; and a guardian
-- for their linked student. (Same reach as the attendance it attests to.)
drop policy if exists record_verifications_select on public.record_verifications;
create policy record_verifications_select on public.record_verifications
  for select using (
    student_id = auth.uid()
    or public.is_group_member(group_id)
    or public.guardian_of(group_id, student_id)
  );

-- Written only through the RPC below.

-- Admin/Captain signs a student's record. Appends a verification (history is
-- kept; the app shows the latest).
create or replace function public.verify_record(
  gid uuid, student_uid uuid, lname text default null, lnote text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  vid uuid;
begin
  if not public.is_group_admin_or_captain(gid) then
    raise exception 'Only an Admin or Captain can verify a record';
  end if;
  if not exists (
    select 1 from public.memberships where group_id = gid and user_id = student_uid
  ) then
    raise exception 'That student is not in this group';
  end if;

  insert into public.record_verifications (group_id, student_id, verified_by, verified_by_name, note)
  values (gid, student_uid, auth.uid(), nullif(lname, ''), nullif(lnote, ''))
  returning id into vid;

  return vid;
end;
$$;

grant execute on function public.verify_record(uuid, uuid, text, text) to authenticated;
