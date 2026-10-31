-- reviews.withheld: add "unsupported-number" to the allowed reason codes (ticket 22, ruling C(b)).
--
-- A Risk flag whose "says" text holds a number the document does not contain is withheld with this
-- reason. Everything else about an entry stays as 20261031000200 set it: exactly {"reason": code},
-- nothing else in it, so no model text is ever stored with a withheld flag.

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
          or (w.entry ->> 'reason') not in ('source-not-found', 'no-source', 'unreadable', 'unsupported-number')
     );
$$;
