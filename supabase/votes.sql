-- Synq — Votes tables + RLS. Run this in the Supabase SQL Editor.
-- (Assumes groups/memberships from schema.sql already exist.)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  question    text not null,
  visibility  text not null default 'live'  check (visibility in ('live', 'hidden')),
  status      text not null default 'open'  check (status in ('open', 'closed')),
  created_by  uuid not null references auth.users (id) on delete cascade,
  creator_name text,                                   -- denormalized (no profiles table yet)
  created_at  timestamptz not null default now()
);

create table if not exists public.vote_options (
  id        uuid primary key default gen_random_uuid(),
  vote_id   uuid not null references public.votes (id) on delete cascade,
  label     text not null,
  position  int  not null default 0
);

create table if not exists public.vote_ballots (
  id          uuid primary key default gen_random_uuid(),
  vote_id     uuid not null references public.votes (id) on delete cascade,
  option_id   uuid not null references public.vote_options (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  voter_name  text,                                    -- denormalized voter name
  updated_at  timestamptz not null default now(),
  unique (vote_id, user_id)                            -- one ballot per person
);

create index if not exists votes_group_idx        on public.votes (group_id);
create index if not exists vote_options_vote_idx   on public.vote_options (vote_id);
create index if not exists vote_ballots_vote_idx   on public.vote_ballots (vote_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → run as owner, bypass RLS, no recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_group_admin_or_captain(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where group_id = gid and user_id = auth.uid() and role in ('Admin', 'Captain')
  );
$$;

create or replace function public.vote_group(vid uuid)
returns uuid language sql security definer set search_path = public as $$
  select group_id from public.votes where id = vid;
$$;

create or replace function public.vote_is_open(vid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.votes where id = vid and status = 'open');
$$;

create or replace function public.is_vote_creator(vid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.votes where id = vid and created_by = auth.uid());
$$;

-- Results (counts + names) are visible when the vote is closed, is live, or you
-- are its creator. Mirrors the client's canSeeResults rule — now enforced.
create or replace function public.vote_results_visible(vid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.votes
    where id = vid and (status = 'closed' or visibility = 'live' or created_by = auth.uid())
  );
$$;

-- Member-gated participation count. Lets a hidden vote show "X people have
-- voted" without exposing any individual ballot rows.
create or replace function public.vote_participation(vid uuid)
returns integer language sql security definer set search_path = public as $$
  select case
    when public.is_group_member(public.vote_group(vid))
    then (select count(*)::int from public.vote_ballots where vote_id = vid)
    else 0
  end;
$$;

-- Batch counts for every vote in a group (member-gated).
create or replace function public.vote_counts(gid uuid)
returns table (vote_id uuid, total integer)
language sql security definer set search_path = public as $$
  select b.vote_id, count(*)::int
  from public.vote_ballots b
  join public.votes v on v.id = b.vote_id
  where v.group_id = gid and public.is_group_member(gid)
  group by b.vote_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.votes        enable row level security;
alter table public.vote_options enable row level security;
alter table public.vote_ballots enable row level security;

-- votes: any group member can see; only Admin/Captain can create; only the
-- creator can update (i.e. close).
drop policy if exists votes_select on public.votes;
create policy votes_select on public.votes
  for select using (public.is_group_member(group_id));

drop policy if exists votes_insert on public.votes;
create policy votes_insert on public.votes
  for insert with check (
    created_by = auth.uid() and public.is_group_admin_or_captain(group_id)
  );

drop policy if exists votes_update on public.votes;
create policy votes_update on public.votes
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

-- options: visible to any group member; insertable only by the vote's creator.
drop policy if exists vote_options_select on public.vote_options;
create policy vote_options_select on public.vote_options
  for select using (public.is_group_member(public.vote_group(vote_id)));

drop policy if exists vote_options_insert on public.vote_options;
create policy vote_options_insert on public.vote_options
  for insert with check (public.is_vote_creator(vote_id));

-- ballots: you can always read your own; others' ballots only when results are
-- visible (closed / live / you're the creator). Members only, and casting or
-- changing a vote is allowed only while the vote is open.
drop policy if exists vote_ballots_select on public.vote_ballots;
create policy vote_ballots_select on public.vote_ballots
  for select using (
    public.is_group_member(public.vote_group(vote_id))
    and (user_id = auth.uid() or public.vote_results_visible(vote_id))
  );

drop policy if exists vote_ballots_insert on public.vote_ballots;
create policy vote_ballots_insert on public.vote_ballots
  for insert with check (
    user_id = auth.uid()
    and public.is_group_member(public.vote_group(vote_id))
    and public.vote_is_open(vote_id)
  );

drop policy if exists vote_ballots_update on public.vote_ballots;
create policy vote_ballots_update on public.vote_ballots
  for update using (user_id = auth.uid() and public.vote_is_open(vote_id))
  with check (user_id = auth.uid());
