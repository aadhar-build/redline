-- QUESTIONS.md 36 (settled by Fable advisor, 2026-10-31): an Outside reference inside a document the
-- Reviewer added gets the same add and mark flow as the contract's own.
--
-- referenced_documents.in_referenced_document_id: the added document whose reference this one was added
--   against, or null when it was added against one of the contract's own references. The foreign key is
--   on (in_referenced_document_id, owner_id), so a row can only point at an added document of the same
--   account (foreign keys ignore Row Level Security). Removing a document removes every document added
--   inside it (on delete cascade). That it belongs to the same saved document is checked by the server,
--   which only links to rows it read back for that document. Depth is bounded by the shared length cap.
--
-- reviews.outside_references: each entry may also carry referenced_document_id, the added document the
--   reference sits in (null for the contract). Entries saved before this migration have no such key and
--   read as the contract's. Widened only: every row valid before stays valid.

alter table public.referenced_documents
  add constraint referenced_documents_id_owner_key unique (id, owner_id);

alter table public.referenced_documents
  add column in_referenced_document_id uuid,
  add constraint referenced_documents_in_referenced_fkey
    foreign key (in_referenced_document_id, owner_id)
    references public.referenced_documents (id, owner_id) on delete cascade,
  add constraint referenced_documents_not_in_itself check (in_referenced_document_id is null or in_referenced_document_id <> id);

create index referenced_documents_in_referenced_idx on public.referenced_documents (in_referenced_document_id);

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
          or ((select array_agg(k order by k) from jsonb_object_keys(r.entry) as keys(k))
                is distinct from array['kinds', 'label', 'reviewed', 'reviewed_at', 'source_sentences']
              and (select array_agg(k order by k) from jsonb_object_keys(r.entry) as keys(k))
                is distinct from array['kinds', 'label', 'referenced_document_id', 'reviewed', 'reviewed_at', 'source_sentences'])
          or (r.entry ? 'referenced_document_id'
              and jsonb_typeof(r.entry -> 'referenced_document_id') is distinct from 'null'
              and (jsonb_typeof(r.entry -> 'referenced_document_id') is distinct from 'string'
                   or (r.entry ->> 'referenced_document_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
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
