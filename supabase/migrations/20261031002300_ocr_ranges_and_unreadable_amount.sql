-- Ticket 23 (ADR 0008, spec-gaps 24): OCR text in saved documents, and the "unreadable-amount" reason.
--
-- documents.ocr_ranges: where Redline's in-browser OCR read the extracted text, as a list of
-- [start, end] integer offsets, in order and not touching. It holds offsets only, never text, so it
-- adds nothing another account could read (documents' Row Level Security covers it as it covers the
-- text). The upper bound (end <= text length) is checked in lib/review/unreadable-amount.js, not here:
-- JavaScript offsets count UTF-16 code units, Postgres length() counts characters.
--
-- reviews.withheld: "unreadable-amount" joins the allowed reason codes. A superset of the old list, so
-- every row stored before stays valid.

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
          or (w.entry ->> 'reason') not in ('source-not-found', 'no-source', 'unreadable', 'unreadable-amount')
     );
$$;

create function public.ocr_ranges_valid(ranges jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  r jsonb;
  s numeric;
  e numeric;
  last_end numeric := -1;
begin
  if jsonb_typeof(ranges) is distinct from 'array' then
    return false;
  end if;
  for r in select value from jsonb_array_elements(ranges) loop
    if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> 2
       or jsonb_typeof(r -> 0) <> 'number' or jsonb_typeof(r -> 1) <> 'number' then
      return false;
    end if;
    s := (r ->> 0)::numeric;
    e := (r ->> 1)::numeric;
    if s <> trunc(s) or e <> trunc(e) or s < 0 or e <= s or s <= last_end then
      return false;
    end if;
    last_end := e;
  end loop;
  return true;
end;
$$;

alter table public.documents
  add column ocr_ranges jsonb not null default '[]'::jsonb
    check (public.ocr_ranges_valid(ocr_ranges));
