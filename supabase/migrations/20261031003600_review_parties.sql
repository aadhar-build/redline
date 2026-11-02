-- Ticket 24 part 2 (settled by Fable advisor, 2026-10-31): a saved review keeps the party terms it showed,
-- so a reopened review can offer them in a list when the Reviewer changes whose side it is for.
--
-- reviews.parties: the terms the document uses for its parties, as the review showed them. On reopen only
-- the terms the stored text still uses are kept (lib/review/saved.js). Rows saved before this migration
-- have '{}' and reopen with the stored Owner alone. The grants and owner-only Row Level Security policies
-- on reviews cover this column as they cover the rest.

alter table public.reviews
  add column parties text[] not null default '{}';
