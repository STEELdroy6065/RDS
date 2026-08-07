-- Synq — deletion / removal controls. Run in the Supabase SQL Editor.
-- (Assumes all previous migrations have been run.)

-- ---------------------------------------------------------------------------
-- Messages: soft delete (WhatsApp-style "This message was deleted").
-- ---------------------------------------------------------------------------

alter table public.posts add column if not exists deleted boolean not null default false;

-- Delete/unsend a message: the author, or the group's Admin/Captain
-- (moderation). Soft delete — clears the text and flags it.
create or replace function public.delete_post(pid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid; a uuid;
begin
  select group_id, author_id into gid, a from public.posts where id = pid;
  if gid is null then return; end if;
  if a = auth.uid() or public.is_group_admin_or_captain(gid) then
    update public.posts set deleted = true, text = '' where id = pid;
  end if;
end;
$$;

grant execute on function public.delete_post(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Groups: leave (any member) and delete (Admin only).
-- ---------------------------------------------------------------------------

-- Leave a group — a user may delete their own membership row.
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete using (user_id = auth.uid());

-- Delete a whole group — only the group's Admin. FK ON DELETE CASCADE removes
-- all its memberships, posts, votes, attendance, and notifications.
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete using (public.is_group_admin(id));

-- ---------------------------------------------------------------------------
-- Votes: delete an entire vote — the creator, or the group's Admin/Captain
-- (open or closed). Cascade removes its options and ballots.
-- ---------------------------------------------------------------------------

drop policy if exists votes_delete on public.votes;
create policy votes_delete on public.votes
  for delete using (
    created_by = auth.uid() or public.is_group_admin_or_captain(group_id)
  );
