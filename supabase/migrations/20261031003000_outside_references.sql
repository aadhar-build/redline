-- reviews.outside_references: the Outside references of a saved review (ticket 13, ADR 0007).
--
-- Each entry is exactly {"kinds", "source_sentence", "reviewed", "reviewed_at"}:
-- - kinds: a non-empty array of the kinds Redline names (lib/review/outside-references.js);
-- - source_sentence: the referencing sentence's text, non-empty. It is checked against the stored
--   document text again every time the review is reopened;
-- - reviewed: whether the Reviewer marked the reference as reviewed. That is the Reviewer's statement,
--   not something Redline checked;
-- - reviewed_at: when they made it, set exactly when reviewed is true.
-- Nothing else is allowed in an entry, so no model text or Redline wording is stored with a reference:
-- its title, explanation and Counter-offer are rebuilt from the kinds on reopen.
--
-- Rows are owned and isolated as before: the reviews policies (owner reads, inserts, updates, deletes,
-- 20261031000000) cover the new column. Marking a reference reviewed is an update of the Reviewer's own
-- row.

create function public.outside_references_valid(refs jsonb)
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
               is distinct from array['kinds', 'reviewed', 'reviewed_at', 'source_sentence']
          or jsonb_typeof(r.entry -> 'kinds') is distinct from 'array'
          or jsonb_array_length(r.entry -> 'kinds') = 0
          or exists (
               select 1
               from jsonb_array_elements(r.entry -> 'kinds') as k(kind)
               where jsonb_typeof(k.kind) <> 'string'
                  or (k.kind #>> '{}') not in ('as-amended', 'web-address', 'statement-of-work', 'order-form', 'schedule', 'other')
             )
          or jsonb_typeof(r.entry -> 'source_sentence') is distinct from 'string'
          or length(btrim(r.entry ->> 'source_sentence')) = 0
          or jsonb_typeof(r.entry -> 'reviewed') is distinct from 'boolean'
          or (case when (r.entry ->> 'reviewed')::boolean
                then jsonb_typeof(r.entry -> 'reviewed_at') is distinct from 'string'
                  or (r.entry ->> 'reviewed_at') !~ '^\d{4}-\d{2}-\d{2}T'
                else jsonb_typeof(r.entry -> 'reviewed_at') is distinct from 'null'
              end)
     );
$$;

alter table public.reviews
  add column outside_references jsonb not null default '[]'::jsonb
    check (public.outside_references_valid(outside_references));
