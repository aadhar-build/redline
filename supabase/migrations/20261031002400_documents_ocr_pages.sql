-- Ticket 23, QUESTIONS 18 (decided by the product owner on 2026-10-31): OCR text is marked per document.
--
-- documents.ocr_pages: the 1-based pages Redline's in-browser OCR read, ascending and distinct.
-- documents.page_count: the PDF's page count when OCR read any of it, so the note can say "2 of 12".
-- Page numbers only, never the scan or any image. Row Level Security on documents covers both columns
-- as it covers the text, so no account can read another's.

create function public.ocr_pages_valid(pages jsonb, page_count integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  p jsonb;
  n numeric;
  last_page numeric := 0;
begin
  if jsonb_typeof(pages) is distinct from 'array' then
    return false;
  end if;
  for p in select value from jsonb_array_elements(pages) loop
    if jsonb_typeof(p) <> 'number' then
      return false;
    end if;
    n := (p #>> '{}')::numeric;
    if n <> trunc(n) or n <= last_page or (page_count is not null and n > page_count) then
      return false;
    end if;
    last_page := n;
  end loop;
  return true;
end;
$$;

alter table public.documents
  add column ocr_pages jsonb not null default '[]'::jsonb,
  add column page_count integer check (page_count is null or page_count > 0),
  add constraint documents_ocr_pages_valid check (public.ocr_pages_valid(ocr_pages, page_count));
