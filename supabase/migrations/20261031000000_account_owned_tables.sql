-- Documents, reviews and Red lines, each owned by one account (auth.users).
--
-- Isolation is enforced here, in the database: Row Level Security limits every
-- read and write to rows whose owner_id is the signed-in account. The anon
-- role gets no access at all.
--
-- What is never stored: original files (only extracted text is kept, so there
-- is no bytea column and no storage bucket), Claude account credentials, and
-- session tokens of any kind.

-- ---------------------------------------------------------------------------
-- documents: the extracted text of a contract, never the original file.
-- ---------------------------------------------------------------------------
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  title          text not null default '',
  -- How the text reached Redline. The file itself never leaves the browser.
  source_kind    text not null check (source_kind in ('pdf', 'docx', 'pasted')),
  extracted_text text not null check (length(extracted_text) > 0),
  created_at     timestamptz not null default now(),
  -- Lets reviews reference (id, owner_id) so a review can only point at a
  -- document owned by the same account. Foreign keys ignore RLS, so this is
  -- what stops one account attaching a review to another account's document.
  unique (id, owner_id)
);

create index documents_owner_id_idx on public.documents (owner_id);

-- ---------------------------------------------------------------------------
-- red_lines: the account's current editable list. Default Red lines (ADR 0004)
-- carry default_number 1-4; Red lines the Reviewer adds have none.
-- ---------------------------------------------------------------------------
create table public.red_lines (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  text           text not null check (length(btrim(text)) > 0),
  default_number smallint check (default_number between 1 and 4),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index red_lines_owner_id_idx on public.red_lines (owner_id);

-- Each Default Red line appears at most once per account.
create unique index red_lines_one_default_each
  on public.red_lines (owner_id, default_number)
  where default_number is not null;

-- ---------------------------------------------------------------------------
-- reviews: one analysis of one document.
-- ---------------------------------------------------------------------------

-- A flag may cite several Source sentences (spec-gaps 11); each flag must cite
-- at least one, because a flag whose source cannot be shown is a bug.
create function public.flags_cite_source_sentences(flags jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(flags) = 'array'
     and not exists (
       select 1
       from jsonb_array_elements(flags) as f(flag)
       where jsonb_typeof(f.flag) <> 'object'
          or jsonb_typeof(f.flag -> 'source_sentences') is distinct from 'array'
          or jsonb_array_length(f.flag -> 'source_sentences') = 0
          or exists (
               select 1
               from jsonb_array_elements(f.flag -> 'source_sentences') as s(sentence)
               where jsonb_typeof(s.sentence) <> 'string'
                  or length(s.sentence #>> '{}') = 0
             )
     );
$$;

create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  document_id    uuid not null,
  -- The exact Red line list this review was checked against (spec-gaps 20).
  -- A copy, not a reference, so later edits to red_lines cannot change it.
  red_lines      jsonb not null check (jsonb_typeof(red_lines) = 'array'),
  summary        text,
  -- Shown flags, each with its checked Source sentences.
  flags          jsonb not null default '[]'::jsonb
                   check (public.flags_cite_source_sentences(flags)),
  -- Flags withheld because their source could not be found (spec-gaps 16).
  withheld_count integer not null default 0 check (withheld_count >= 0),
  created_at     timestamptz not null default now(),
  foreign key (document_id, owner_id)
    references public.documents (id, owner_id) on delete cascade
);

create index reviews_owner_id_idx on public.reviews (owner_id);
create index reviews_document_id_idx on public.reviews (document_id);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant ALL (including TRUNCATE,
-- which bypasses RLS) to anon and authenticated. Take everything away, then
-- give signed-in accounts only the four row-level operations.
-- ---------------------------------------------------------------------------
revoke all on public.documents, public.red_lines, public.reviews from anon, authenticated;
grant select, insert, update, delete
  on public.documents, public.red_lines, public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: an account sees and changes only its own rows.
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.red_lines enable row level security;
alter table public.reviews   enable row level security;

alter table public.documents force row level security;
alter table public.red_lines force row level security;
alter table public.reviews   force row level security;

-- documents
create policy "documents: owner reads" on public.documents
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "documents: owner inserts" on public.documents
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "documents: owner updates" on public.documents
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "documents: owner deletes" on public.documents
  for delete to authenticated using (owner_id = (select auth.uid()));

-- red_lines
create policy "red_lines: owner reads" on public.red_lines
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "red_lines: owner inserts" on public.red_lines
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "red_lines: owner updates" on public.red_lines
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "red_lines: owner deletes" on public.red_lines
  for delete to authenticated using (owner_id = (select auth.uid()));

-- reviews
create policy "reviews: owner reads" on public.reviews
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "reviews: owner inserts" on public.reviews
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "reviews: owner updates" on public.reviews
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "reviews: owner deletes" on public.reviews
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Keep red_lines.updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

create trigger red_lines_touch_updated_at
  before update on public.red_lines
  for each row execute function public.touch_updated_at();
