-- Synq — in-app notifications. Run in the Supabase SQL Editor.
-- (Assumes groups/memberships, votes, posts, post_reports already exist.)

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  group_id    uuid references public.groups (id) on delete cascade,
  type        text not null check (type in ('new_vote', 'new_announcement', 'attendance_missed', 'post_reported')),
  message     text not null,
  entity_id   uuid,                                  -- the vote/post the alert points at (if any)
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- You can only see and update (mark read) your own notifications. Inserts come
-- from SECURITY DEFINER triggers/functions below, not from clients.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Triggers — fan out notifications when things happen.
-- ---------------------------------------------------------------------------

-- New vote → every group member except the creator.
create or replace function public.notify_new_vote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, group_id, type, message, entity_id)
  select m.user_id, NEW.group_id, 'new_vote',
         'New vote: ' || left(NEW.question, 80), NEW.id
  from public.memberships m
  where m.group_id = NEW.group_id and m.user_id <> NEW.created_by;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_new_vote on public.votes;
create trigger trg_notify_new_vote after insert on public.votes
  for each row execute function public.notify_new_vote();

-- New Announcement post → every group member except the author.
create or replace function public.notify_new_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.type = 'Announcement' then
    insert into public.notifications (user_id, group_id, type, message, entity_id)
    select m.user_id, NEW.group_id, 'new_announcement',
           'Announcement: ' || left(NEW.text, 80), NEW.id
    from public.memberships m
    where m.group_id = NEW.group_id and m.user_id <> NEW.author_id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_new_announcement on public.posts;
create trigger trg_notify_new_announcement after insert on public.posts
  for each row execute function public.notify_new_announcement();

-- Post reported → the group's Admins/Captains, except the reporter.
create or replace function public.notify_post_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from public.posts where id = NEW.post_id;
  if gid is null then return NEW; end if;
  insert into public.notifications (user_id, group_id, type, message, entity_id)
  select m.user_id, gid, 'post_reported', 'A post was reported', NEW.post_id
  from public.memberships m
  where m.group_id = gid and m.role in ('Admin', 'Captain') and m.user_id <> NEW.reported_by;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_post_reported on public.post_reports;
create trigger trg_notify_post_reported after insert on public.post_reports
  for each row execute function public.notify_post_reported();

-- ---------------------------------------------------------------------------
-- Missed check-in — there is no server event (it's computed on read), so the
-- app calls this when it detects the missed state. Notifies the group's
-- Captain(s), at most once per group per day.
-- ---------------------------------------------------------------------------

create or replace function public.notify_missed_checkin(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.memberships where group_id = gid and user_id = auth.uid()) then
    return; -- only members of the group may trigger this
  end if;

  insert into public.notifications (user_id, group_id, type, message)
  select m.user_id, gid, 'attendance_missed', 'Today’s check-in was missed'
  from public.memberships m
  where m.group_id = gid and m.role = 'Captain'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.group_id = gid
        and n.type = 'attendance_missed' and n.created_at::date = current_date
    );
end;
$$;

grant execute on function public.notify_missed_checkin(uuid) to authenticated, anon;
