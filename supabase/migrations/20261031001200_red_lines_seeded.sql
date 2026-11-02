-- Ticket 12: the Reviewer edits their Red lines.
--
-- account_settings.red_lines_seeded_at records when the four Default Red lines were first saved to the
-- account. Seeding happens once: a Reviewer who removes a Default Red line, or all four, does not get
-- them back on the next visit (ADR 0004: removing one removes its protection). Null means not seeded
-- yet. It lives on account_settings, which already has one row per account under owner-only RLS.
alter table public.account_settings
  add column red_lines_seeded_at timestamptz;

-- A Red line goes into the review prompt as one line. Keep it to one paragraph of a sensible length.
alter table public.red_lines
  add constraint red_lines_text_length check (length(text) <= 500);
