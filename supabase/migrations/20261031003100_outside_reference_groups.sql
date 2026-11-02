-- reviews.outside_references: one entry per referenced document (QUESTIONS.md 30, settled by the Fable
-- advisor, 2026-10-31; ADR 0007 addendum). Replaces the per-sentence shape of 20261031003000.
--
-- Each entry is now exactly {"kinds", "label", "source_sentences", "reviewed", "reviewed_at"}:
-- - kinds: a non-empty array of the kinds Redline names (lib/review/outside-references.js);
-- - label: the referenced document as Redline's patterns name it ("Order Form", "Schedule B", a web
--   address, or the matched "as amended" words), or null;
-- - source_sentences: a non-empty array of the referencing sentences' text, each non-empty. Each is
--   checked against the stored document text again every time the review is reopened;
-- - reviewed: whether the Reviewer marked the reference as reviewed (one mark for the whole group). That
--   is the Reviewer's statement, not something Redline checked;
-- - reviewed_at: when they made it, set exactly when reviewed is true.
-- Nothing else is allowed in an entry, so no model text is stored with a reference.
--
-- The rows saved so far are test data only, so their references are cleared: they are found again from
-- the stored text on reopen, without the old marks.
--
-- Rows stay owned and isolated by the reviews policies (20261031000000); this changes no policy.

alter table public.reviews drop constraint if exists reviews_outside_references_check;

update public.reviews set outside_references = '[]'::jsonb where outside_references <> '[]'::jsonb;

create or replace function public.outside_references_valid(refs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(refs) = 'array'
     and not exists (
       select 1
       from jsonb_array_elements(refs) as r(entry)
       where jsonb_typeof(r.entry) <> 'object'
          or (select array_agg(k order by k) from jsonb_object_keys(r.entry) as keys(k))
               is distinct from array['kinds', 'label', 'reviewed', 'reviewed_at', 'source_sentences']
          or jsonb_typeof(r.entry -> 'kinds') is distinct from 'array'
          or jsonb_array_length(r.entry -> 'kinds') = 0
          or exists (
               select 1
               from jsonb_array_elements(r.entry -> 'kinds') as k(kind)
               where jsonb_typeof(k.kind) <> 'string'
                  or (k.kind #>> '{}') not in ('as-amended', 'web-address', 'statement-of-work', 'order-form', 'schedule', 'other')
             )
          or (jsonb_typeof(r.entry -> 'label') is distinct from 'null'
              and (jsonb_typeof(r.entry -> 'label') is distinct from 'string'
                   or length(btrim(r.entry ->> 'label')) = 0))
          or jsonb_typeof(r.entry -> 'source_sentences') is distinct from 'array'
          or jsonb_array_length(r.entry -> 'source_sentences') = 0
          or exists (
               select 1
               from jsonb_array_elements(r.entry -> 'source_sentences') as s(sentence)
               where jsonb_typeof(s.sentence) <> 'string'
                  or length(btrim(s.sentence #>> '{}')) = 0
             )
          or jsonb_typeof(r.entry -> 'reviewed') is distinct from 'boolean'
          or (case when (r.entry ->> 'reviewed')::boolean
                then jsonb_typeof(r.entry -> 'reviewed_at') is distinct from 'string'
                  or (r.entry ->> 'reviewed_at') !~ '^\d{4}-\d{2}-\d{2}T'
                else jsonb_typeof(r.entry -> 'reviewed_at') is distinct from 'null'
              end)
     );
$$;

alter table public.reviews
  add constraint reviews_outside_references_check check (public.outside_references_valid(outside_references));
