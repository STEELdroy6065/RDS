-- RDS — extracted text/description for uploaded files.
-- Run in the Supabase dashboard → SQL Editor after the earlier migrations.
--
-- Stores the text pulled out of each attachment at upload time (PDF/docx/pptx
-- parsing, or OCR + a short AI description for images) so both search and the
-- assistant can see what's *inside* a file, not just its name.

alter table public.posts add column if not exists attachment_text text;
alter table public.posts add column if not exists attachment_text_status text; -- 'done' | 'failed' | null

-- Trigram index so ILIKE '%term%' content search stays fast at scale.
create extension if not exists pg_trgm;
create index if not exists posts_attachment_text_trgm
  on public.posts using gin (attachment_text gin_trgm_ops);
