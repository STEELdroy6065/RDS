-- RDS — Attendance v2: per-member P/L/A/E status.
-- Run this in the Supabase SQL Editor AFTER attendance.sql.
--
-- Adds a four-state status to each roll entry:
--   P = Present, L = Late, A = Absent, E = Excused
-- The older boolean `present` column is kept and backfilled so nothing that
-- reads it breaks; new writes set both (`present` = status in ('P','L')).

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

alter table public.attendance_entries
  add column if not exists status text not null default 'P'
    check (status in ('P', 'L', 'A', 'E'));

-- Backfill existing rows from the legacy boolean.
update public.attendance_entries
  set status = case when present then 'P' else 'A' end
  where status is null or status = 'P' and present = false;

-- Fast per-member lookups (term record / streak).
create index if not exists attendance_entries_user_idx
  on public.attendance_entries (user_id);

-- ---------------------------------------------------------------------------
-- Keep `present` consistent with `status` on write, so old readers still work
-- even if a client only sets one of the two.
-- ---------------------------------------------------------------------------

create or replace function public.sync_attendance_present()
returns trigger language plpgsql as $$
begin
  new.present := new.status in ('P', 'L');
  return new;
end;
$$;

drop trigger if exists attendance_entries_sync on public.attendance_entries;
create trigger attendance_entries_sync
  before insert or update on public.attendance_entries
  for each row execute function public.sync_attendance_present();
