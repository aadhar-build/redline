-- referenced_documents: the text of a document an Outside reference brings in, added by the Reviewer
-- against that reference (ticket 18, ADR 0007, spec-gaps 14). Like documents, only the extracted text is
-- stored: the file is read in the browser and never leaves it.
--
-- - document_id: the saved document whose Outside reference this resolves. The foreign key is on
--   (document_id, owner_id), so a row can only point at a document owned by the same account (foreign
--   keys ignore Row Level Security; this is what stops attaching to another account's document).
-- - reference_sentence: the text of the referencing sentence, as shown on the Outside reference. It names
--   which reference this resolves and is matched against the review's references again on every reopen.
-- - ocr_ranges, ocr_pages, page_count: where OCR read a PDF's text (ADR 0008), with the same checks as on
--   documents, so the unreadable-amount rule applies to this text too.
--
-- reviews.referenced_document_ids: the referenced documents a review was run together with (spec-gaps
-- 14: one review). A reference counts as resolved only on a review that lists its document here and
-- when that row can be read back for the same document under Row Level Security.

create table public.referenced_documents (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  document_id        uuid not null,
  reference_sentence text not null check (length(btrim(reference_sentence)) > 0),
  title              text not null default '',
  source_kind        text not null check (source_kind in ('pdf', 'docx', 'pasted')),
  extracted_text     text not null check (length(extracted_text) > 0),
  ocr_ranges         jsonb not null default '[]'::jsonb check (public.ocr_ranges_valid(ocr_ranges)),
  ocr_pages          jsonb not null default '[]'::jsonb,
  page_count         integer check (page_count is null or page_count > 0),
  created_at         timestamptz not null default now(),
  constraint referenced_documents_ocr_pages_valid check (public.ocr_pages_valid(ocr_pages, page_count)),
  foreign key (document_id, owner_id)
    references public.documents (id, owner_id) on delete cascade
);

create index referenced_documents_owner_id_idx on public.referenced_documents (owner_id);
create index referenced_documents_document_id_idx on public.referenced_documents (document_id);

revoke all on public.referenced_documents from anon, authenticated;
grant select, insert, update, delete on public.referenced_documents to authenticated;

alter table public.referenced_documents enable row level security;
alter table public.referenced_documents force row level security;

create policy "referenced_documents: owner reads" on public.referenced_documents
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "referenced_documents: owner inserts" on public.referenced_documents
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "referenced_documents: owner updates" on public.referenced_documents
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "referenced_documents: owner deletes" on public.referenced_documents
  for delete to authenticated using (owner_id = (select auth.uid()));

alter table public.reviews
  add column referenced_document_ids uuid[] not null default '{}';
