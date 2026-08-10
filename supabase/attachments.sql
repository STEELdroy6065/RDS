-- RDS — Feed attachments (images + files) via Supabase Storage.
-- Run this in the Supabase dashboard → SQL Editor after the earlier migrations.

-- ---------------------------------------------------------------------------
-- 1) Attachment metadata on posts. A message can now be an image or a file
--    with no text body, so `text` becomes nullable.
-- ---------------------------------------------------------------------------

alter table public.posts add column if not exists attachment_url  text;
alter table public.posts add column if not exists attachment_type text;   -- 'image' | 'file'
alter table public.posts add column if not exists attachment_name text;
alter table public.posts add column if not exists attachment_mime text;

alter table public.posts alter column text drop not null;

-- ---------------------------------------------------------------------------
-- 2) Public storage bucket for attachments. Uploads land under unguessable
--    UUID-ish paths; the bucket is public so images render and files open via
--    their public URL. Only authenticated users may upload.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects
  for select using (bucket_id = 'attachments');
