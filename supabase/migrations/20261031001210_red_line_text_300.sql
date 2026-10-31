-- Ticket 12, settled by Fable advisor 2026-10-31: a Red line is at most 300 characters, the limit the
-- Red lines page states and lib/library/red-lines.js enforces, so the stored and advertised limits agree.
-- (The 30-per-account limit is enforced in lib/library/red-lines.js only; see the note there.)
alter table public.red_lines drop constraint red_lines_text_length;
alter table public.red_lines
  add constraint red_lines_text_length check (length(text) <= 300);
