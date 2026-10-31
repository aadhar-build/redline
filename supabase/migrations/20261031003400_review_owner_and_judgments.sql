-- Ticket 24 part 2, QUESTIONS 23 (settled by Fable advisor, 2026-10-31): a saved review keeps whose side
-- it was for and how many judgments were dropped, so a reopened review can show both.
--
-- reviews.owner_party: the term the document uses for the Owner, or null when Redline couldn't tell.
-- reviews.owner_fixed: true when the Reviewer chose the Owner with Change.
-- reviews.judgments_dropped: how many judgments were left out because they claimed what is usual.
-- Rows saved before this migration read as no Owner, not fixed, and none dropped. The table-level grants
-- and the owner-only Row Level Security policies on reviews cover these columns as they cover the rest.

alter table public.reviews
  add column owner_party text check (owner_party is null or length(btrim(owner_party)) > 0),
  add column owner_fixed boolean not null default false,
  add column judgments_dropped integer not null default 0 check (judgments_dropped >= 0);
