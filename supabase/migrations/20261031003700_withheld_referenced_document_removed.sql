-- QUESTIONS.md 37 (settled by Fable advisor, 2026-10-31): the Reviewer can remove a document they added.
-- An earlier review that was run with it keeps its row; its flags from that document reopen as withheld
-- with the reason "referenced-document-removed". The withheld list allows that code too, so the stored
-- reasons and the reopened ones use one set. Widened only: every row valid before stays valid.

create or replace function public.withheld_reasons_valid(withheld jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(withheld) = 'array'
     and not exists (
       select 1
       from jsonb_array_elements(withheld) as w(entry)
       where jsonb_typeof(w.entry) <> 'object'
          or (select array_agg(k order by k) from jsonb_object_keys(w.entry) as keys(k)) is distinct from array['reason']
          or jsonb_typeof(w.entry -> 'reason') is distinct from 'string'
          or (w.entry ->> 'reason') not in ('source-not-found', 'no-source', 'unreadable', 'unsupported-number', 'unreadable-amount', 'referenced-document-removed')
     );
$$;
