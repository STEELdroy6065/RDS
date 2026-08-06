-- Synq — content reporting + post moderation. Run in the Supabase SQL Editor.
-- (Assumes posts from feed.sql and helpers from votes.sql already exist.)

create table if not exists public.post_reports (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  reported_by  uuid not null references auth.users (id) on delete cascade,
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists post_reports_post_idx on public.post_reports (post_id);

-- Which group does a post belong to? (SECURITY DEFINER → usable in policies.)
create or replace function public.post_group(pid uuid)
returns uuid language sql security definer set search_path = public as $$
  select group_id from public.posts where id = pid;
$$;

alter table public.post_reports enable row level security;

-- Any group member can report a post (as themselves).
drop policy if exists post_reports_insert on public.post_reports;
create policy post_reports_insert on public.post_reports
  for insert with check (
    reported_by = auth.uid() and public.is_group_member(public.post_group(post_id))
  );

-- Only the group's Admin/Captain can see the reports.
drop policy if exists post_reports_select on public.post_reports;
create policy post_reports_select on public.post_reports
  for select using (public.is_group_admin_or_captain(public.post_group(post_id)));

-- Moderation: the group's Admin/Captain can delete (remove) a post.
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete using (public.is_group_admin_or_captain(group_id));
