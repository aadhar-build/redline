# 14: Source sentence matching rule

**What to build:** The written rule for "the same sentence" replaces ticket 03's interim identical-text check.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** OQ9: ADR 0010; fixtures from ../../spec-gaps/research/09-what-extraction-does-to-sentences.md section 7.

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] Fixtures with line-break, hyphenation and whitespace changes behave as the rule states.
- [ ] Every displayed Source sentence is found under the rule in every run (PRD criterion 1).
- [ ] Altered and invented Source sentences are still withheld (PRD criterion 2).
