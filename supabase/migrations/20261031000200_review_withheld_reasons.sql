-- reviews.withheld: why each withheld Risk flag was withheld (ticket 10, settled by Fable advisor
-- 2026-10-31), so a reopened review shows the same withheld line as a fresh one.
--
-- Each entry is exactly {"reason": code}, with code one of Review's three withheld reasons. Nothing else
-- is allowed in an entry, so no model text can be stored with a withheld flag. withheld_count must
-- equal the number of entries.

create function public.withheld_reasons_valid(withheld jsonb)
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
          or (w.entry ->> 'reason') not in ('source-not-found', 'no-source', 'unreadable')
     );
$$;

alter table public.reviews
  add column withheld jsonb not null default '[]'::jsonb
    check (public.withheld_reasons_valid(withheld));

-- No review has been saved before this migration (the library lands with it), so no row needs a
-- made-up reason. A row with a count but no reasons would fail here rather than get a false one.
alter table public.reviews
  add constraint reviews_withheld_count_matches
    check (withheld_count = jsonb_array_length(withheld));
