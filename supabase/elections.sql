-- RDS — Captain elections & handover. Run in the Supabase SQL Editor AFTER
-- votes.sql, notifications.sql and leave.sql.
--
-- Turns a vote into an election: its options are candidates (members), and
-- closing it actually transfers the Captain role to the winner, records the
-- term, and tells the group. Builds on the existing votes tables.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.votes
  add column if not exists kind text not null default 'poll'
    check (kind in ('poll', 'captain_election'));
alter table public.votes
  add column if not exists term_ends date;

alter table public.vote_options
  add column if not exists candidate_id uuid references auth.users (id) on delete cascade;

-- A record of who held Captain, when, and via which election. Powers the
-- "terms as Captain" figure on the portable record.
create table if not exists public.captain_terms (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  user_name    text,
  elected_via  uuid references public.votes (id) on delete set null,
  started_at   timestamptz not null default now(),
  ends_at      date,
  ended        boolean not null default false
);

create index if not exists captain_terms_group_idx on public.captain_terms (group_id);
create index if not exists captain_terms_user_idx  on public.captain_terms (user_id);

alter table public.captain_terms enable row level security;

drop policy if exists captain_terms_select on public.captain_terms;
create policy captain_terms_select on public.captain_terms
  for select using (
    user_id = auth.uid()
    or public.is_group_member(group_id)
    or public.is_group_guardian(group_id)
  );
-- Written only by close_election().

-- ---------------------------------------------------------------------------
-- Notification types — add captain_elected (re-declare the full set).
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_vote', 'new_announcement', 'attendance_missed', 'post_reported',
    'leave_requested', 'leave_decided', 'captain_elected'
  ));

-- ---------------------------------------------------------------------------
-- Close an election: pick the winner, transfer the Captain role, record the
-- term, notify the group. Organiser (creator) or an Admin/Captain may close.
-- ---------------------------------------------------------------------------

create or replace function public.close_election(vid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  k text;
  st text;
  tends date;
  winner uuid;
  wname text;
begin
  select group_id, kind, status, term_ends into gid, k, st, tends
    from public.votes where id = vid;
  if gid is null then raise exception 'Vote not found'; end if;
  if k <> 'captain_election' then raise exception 'This vote is not an election'; end if;
  if st = 'closed' then raise exception 'This election is already closed'; end if;
  if not (
    public.is_group_admin_or_captain(gid)
    or exists (select 1 from public.votes where id = vid and created_by = auth.uid())
  ) then
    raise exception 'Only the organiser can close this election';
  end if;

  -- Winner = candidate with the most ballots (ties broken by option order).
  select o.candidate_id, o.label into winner, wname
  from public.vote_options o
  left join public.vote_ballots b on b.option_id = o.id
  where o.vote_id = vid and o.candidate_id is not null
  group by o.candidate_id, o.label, o.position
  order by count(b.id) desc, o.position asc
  limit 1;

  if winner is null then raise exception 'This election has no candidates'; end if;

  update public.votes set status = 'closed' where id = vid;

  -- Transfer the Captain role. Existing Captains (not the winner) step down to
  -- Member; the winner steps up (Admins keep their higher role).
  update public.memberships set role = 'Member'
    where group_id = gid and role = 'Captain' and user_id <> winner;
  update public.memberships set role = 'Captain'
    where group_id = gid and user_id = winner and role = 'Member';

  -- Close the prior term and open the new one.
  update public.captain_terms set ended = true where group_id = gid and ended = false;
  insert into public.captain_terms (group_id, user_id, user_name, elected_via, ends_at)
    values (gid, winner, wname, vid, tends);

  -- Tell the group (except the winner, who gets the good news in-app).
  insert into public.notifications (user_id, group_id, type, message, entity_id)
  select m.user_id, gid, 'captain_elected',
         coalesce(nullif(wname, ''), 'A new Captain') || ' is the new Captain', vid
  from public.memberships m
  where m.group_id = gid and m.user_id <> winner;

  return winner;
end;
$$;

grant execute on function public.close_election(uuid) to authenticated;
