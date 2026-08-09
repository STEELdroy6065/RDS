-- RDS — group description + Admin-configurable member permissions.
-- Run this in the Supabase dashboard → SQL Editor → New query → Run.
-- (Assumes all previous migrations have been run.)

-- ---------------------------------------------------------------------------
-- New columns on groups: an editable description and three permission toggles
-- for what regular Members are allowed to do. All default to the current
-- behavior (on), so nothing changes until an Admin turns something off.
-- ---------------------------------------------------------------------------

alter table public.groups add column if not exists description text;
alter table public.groups add column if not exists allow_member_post boolean not null default true;
alter table public.groups add column if not exists allow_member_invite boolean not null default true;
alter table public.groups add column if not exists allow_member_view_members boolean not null default true;

-- ---------------------------------------------------------------------------
-- Admin can edit the group's own row (description + permission toggles).
-- ---------------------------------------------------------------------------

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update using (public.is_group_admin(id)) with check (public.is_group_admin(id));

-- ---------------------------------------------------------------------------
-- Enforce the "members can post" toggle server-side. Admin/Captain always
-- post; a regular Member may post only while the group allows it. SECURITY
-- DEFINER helper reads the flag without tripping RLS.
-- ---------------------------------------------------------------------------

create or replace function public.group_allows_member_post(gid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select allow_member_post from public.groups where id = gid), true);
$$;

grant execute on function public.group_allows_member_post(uuid) to authenticated, anon;

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author_id = auth.uid()
    and public.is_group_member(group_id)
    and (
      public.is_group_admin_or_captain(group_id)
      or public.group_allows_member_post(group_id)
    )
  );
