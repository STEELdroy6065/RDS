-- Synq — Feed (posts) table + RLS. Run this in the Supabase SQL Editor.
-- (Assumes groups/memberships from schema.sql already exist.)

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  author_id    uuid not null references auth.users (id) on delete cascade,
  author_name  text,                                    -- denormalized (no profiles table yet)
  type         text not null check (type in ('Announcement', 'Resource', 'Discussion')),
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists posts_group_idx on public.posts (group_id);

alter table public.posts enable row level security;

-- Only group members can read the feed.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (public.is_group_member(group_id));

-- Any group member can post (as themselves).
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author_id = auth.uid() and public.is_group_member(group_id)
  );
