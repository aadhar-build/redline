-- account_settings: one row per account, owned like every other Redline table.
--
-- udyam_micro_or_small records the Owner's answer, asked once in account
-- settings, to whether the Owner is a Udyam-registered micro or small
-- enterprise. MSMED Act rows of the Market standard table apply only when it
-- is true. Null means the question has not been answered.

create table public.account_settings (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() unique
                         references auth.users (id) on delete cascade,
  udyam_micro_or_small boolean,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

revoke all on public.account_settings from anon, authenticated;
grant select, insert, update, delete on public.account_settings to authenticated;

alter table public.account_settings enable row level security;
alter table public.account_settings force row level security;

create policy "account_settings: owner reads" on public.account_settings
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "account_settings: owner inserts" on public.account_settings
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "account_settings: owner updates" on public.account_settings
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "account_settings: owner deletes" on public.account_settings
  for delete to authenticated using (owner_id = (select auth.uid()));

create trigger account_settings_touch_updated_at
  before update on public.account_settings
  for each row execute function public.touch_updated_at();
