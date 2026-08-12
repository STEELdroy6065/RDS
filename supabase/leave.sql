-- RDS — Leave requests + audit trail. Run in the Supabase SQL Editor AFTER
-- schema.sql, attendance.sql and notifications.sql.
--
-- A member requests leave for a date (with a reason and an optional photo of a
-- clinic slip). The group's Admin/Captain approves or declines it. Approved
-- leave surfaces on that day's roll as "E" (Excused). Every action is written
-- to an immutable audit trail. Mutations go through SECURITY DEFINER RPCs so
-- the audit row + notification are always written atomically.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  requester_name  text,
  date            date not null,
  reason          text,
  attachment_url  text,                                  -- clinic slip photo (optional)
  status          text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by      uuid references auth.users (id) on delete set null,
  decided_by_name text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.leave_audit (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.leave_requests (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  actor_id    uuid,
  actor_name  text,
  action      text not null check (action in ('requested', 'approved', 'declined', 'cancelled')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists leave_requests_group_idx on public.leave_requests (group_id, date desc);
create index if not exists leave_requests_user_idx  on public.leave_requests (user_id);
create index if not exists leave_audit_request_idx  on public.leave_audit (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.leave_requests enable row level security;
alter table public.leave_audit    enable row level security;

-- requests: the requester sees their own; Admins/Captains see the whole group.
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select using (
    user_id = auth.uid() or public.is_group_admin_or_captain(group_id)
  );

-- A member cancels their own still-pending request by deleting it.
drop policy if exists leave_requests_delete on public.leave_requests;
create policy leave_requests_delete on public.leave_requests
  for delete using (user_id = auth.uid() and status = 'pending');

-- Inserts + decisions go through the RPCs below (SECURITY DEFINER), so no
-- direct client insert/update policy is granted.

-- audit: visible to the requester and the group's Admins/Captains. Written only
-- by the RPCs.
drop policy if exists leave_audit_select on public.leave_audit;
create policy leave_audit_select on public.leave_audit
  for select using (
    public.is_group_admin_or_captain(group_id)
    or exists (
      select 1 from public.leave_requests r
      where r.id = request_id and r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Notification types — extend the check to cover leave events.
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_vote', 'new_announcement', 'attendance_missed', 'post_reported',
    'leave_requested', 'leave_decided'
  ));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Member requests leave. Returns the new request id. `lname` is the requester's
-- display name (there is no profiles table yet, so the client supplies it).
create or replace function public.request_leave(
  gid uuid, ldate date, lreason text, lname text, lattachment text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if not public.is_group_member(gid) then
    raise exception 'Not a member of this group';
  end if;

  insert into public.leave_requests (group_id, user_id, requester_name, date, reason, attachment_url)
  values (gid, auth.uid(), nullif(lname, ''), ldate, nullif(lreason, ''), nullif(lattachment, ''))
  returning id into rid;

  insert into public.leave_audit (request_id, group_id, actor_id, actor_name, action, note)
  values (rid, gid, auth.uid(), nullif(lname, ''), 'requested', nullif(lreason, ''));

  -- Notify the group's Admins/Captains (they act on it).
  insert into public.notifications (user_id, group_id, type, message, entity_id)
  select m.user_id, gid, 'leave_requested',
         coalesce(nullif(lname, '') || ' requested leave', 'New leave request'), rid
  from public.memberships m
  where m.group_id = gid and m.role in ('Admin', 'Captain') and m.user_id <> auth.uid();

  return rid;
end;
$$;

-- Admin/Captain approves or declines a request. `lname` is the decider's name.
create or replace function public.decide_leave(rid uuid, decision text, lname text default null, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  requester uuid;
begin
  if decision not in ('approved', 'declined') then
    raise exception 'Invalid decision';
  end if;

  select group_id, user_id into gid, requester from public.leave_requests where id = rid;
  if gid is null then
    raise exception 'Leave request not found';
  end if;
  if not public.is_group_admin_or_captain(gid) then
    raise exception 'Only an Admin or Captain can decide leave';
  end if;

  update public.leave_requests
    set status = decision, decided_by = auth.uid(), decided_by_name = nullif(lname, ''), decided_at = now()
    where id = rid and status = 'pending';

  insert into public.leave_audit (request_id, group_id, actor_id, actor_name, action, note)
  values (rid, gid, auth.uid(), nullif(lname, ''), decision, nullif(note, ''));

  -- Notify the requester of the outcome.
  insert into public.notifications (user_id, group_id, type, message, entity_id)
  values (requester, gid, 'leave_decided',
          case when decision = 'approved' then 'Your leave was approved'
               else 'Your leave was declined' end,
          rid);
end;
$$;

grant execute on function public.request_leave(uuid, date, text, text, text) to authenticated;
grant execute on function public.decide_leave(uuid, text, text, text) to authenticated;
