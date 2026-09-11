---
name: Redline
description: A contract reviewed like a finished audit workpaper, every Risk flag ticked and cross-referenced to its Source sentence.
colors:
  blue: "#1f4e9c"
  red: "#b3261e"
  amber: "#7a4f00"
  sheet: "#f3f5f1"
  paper: "#ffffff"
  ink: "#2b2b28"
  ink-2: "#53564e"
  rule: "#b9c4b5"
  rule-strong: "#2b2b28"
  ruling: "rgba(31, 78, 156, 0.09)"
  blue-wash: "rgba(31, 78, 156, 0.1)"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  document:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.65
  quote:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1
  label:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.07em"
  label-stamp:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
rounded:
  none: "0"
  xs: "2px"
  sm: "3px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  3xl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0.95rem 1.35rem"
  button-primary-hover:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.sheet}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0.95rem 1.35rem"
  button-quiet-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  text-link:
    textColor: "{colors.blue}"
  header-block:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  pane:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  pane-head:
    padding: "0.85rem 1rem"
  severity-key:
    backgroundColor: "{colors.sheet}"
    padding: "0.6rem 1rem"
  flag-row:
    backgroundColor: "transparent"
    rounded: "{rounded.xs}"
    padding: "0.6rem 0.5rem"
  flag-row-open:
    backgroundColor: "{colors.sheet}"
  stamp-dont:
    textColor: "{colors.red}"
    typography: "{typography.label-stamp}"
    rounded: "{rounded.none}"
    padding: "0.28rem 0.4rem 0.24rem"
  stamp-negotiate:
    textColor: "{colors.amber}"
    typography: "{typography.label-stamp}"
    rounded: "{rounded.none}"
    padding: "0.28rem 0.4rem 0.24rem"
  stamp-know:
    textColor: "{colors.blue}"
    typography: "{typography.label-stamp}"
    rounded: "{rounded.none}"
    padding: "0.28rem 0.4rem 0.24rem"
  source-box:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.quote}"
    rounded: "{rounded.none}"
    padding: "0.3rem 0.65rem 0.6rem"
  counter-offer-box:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.3rem 0.65rem 0.6rem"
  ref-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.blue}"
    rounded: "{rounded.xs}"
    padding: "0.25rem 0.4rem"
  ref-chip-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.blue}"
  count:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0.1rem 0.35rem"
  action-box:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "1.25rem"
---

<!--
Recorded 2026-09-11 in scan mode from the shipped landing page: app/layout.js, app/page.js, app/Demo.js, app/Glyph.js, app/globals.css, checked against .impeccable/review/desktop.png (production build, 2x) and .impeccable/review/mobile.png (390px, 2x).
Direction: Audit Workpaper, candidate 1 of 7, seed 20f69d25; Risk flags pane pinned by the product owner (contract comment in app/layout.js).
Finish review: two review rounds; eight material fixes plus two regressions, all resolved; disposition ship. The verdict passes were run by a replacement reviewer after a session restart.
Pending surfaces that inherit this system: .impeccable/surfaces/app-app-layout-js.md (app shell behind sign-in, not built) and .impeccable/surfaces/app-page-js.md (landing page brief, for further passes on this page).
-->

# Design System: Redline

## Overview

**Creative North Star: "The Audit Workpaper"**

Redline looks like a finished audit workpaper. A pale ruled sheet carries graphite ink, blue reference codes and red pencil. Each Risk flag is a numbered line in an inspection report. It carries an action stamp and a tick, and its reference code points both ways, to the sentence and back. The system makes one claim visually: every point can be traced to the document. Structure does that job. Header-block fields, framed paper surfaces, fixed glyph keys and cross-references carry it, and decoration adds nothing.

Density sits in the middle and reads like a document. Surfaces are square and framed with graphite strokes of set weights. Two faces carry two voices. Source Serif 4 is used for the contract's own words, the Counter-offer wording and headings. Archivo is used for Redline's explanation and the controls. Archivo Narrow, in uppercase, names fields, stamps, groups and boxes. There is one piece of authored motion: a pencil tick is drawn once a Source sentence has been found, and it never appears before that. All other motion is a short state transition, and every hold is skipped under reduced motion.

The direction rejects the legal-AI hero built from a gradient, a product screenshot and "Book a demo". Colour never carries meaning by itself: each Severity has its own glyph shape.

**Key Characteristics:**
- Pale ruled sheet (1.9rem ruling) behind framed white paper surfaces.
- Graphite ink for all text; blue marks references and interaction; red is reserved for Don't sign as written.
- Stroke weights form a hierarchy (2px, 1.5px, 1.75px stamp, 1px, 1px dashed).
- Serif for document words, sans for Redline's voice, narrow uppercase for field labels.
- Numbered Risk flags, Severity stamps, a fixed glyph key, and reference codes set in tabular numerals.
- Square corners on documents; 2–3px only on pressable controls.

## Colors

A restrained workpaper palette: warm-grey graphite on a faintly green-grey sheet, one blue reference ink, and two Severity inks spent only on glyphs and stamps.

### Primary
- **Reference Blue** (`blue`): the ink of cross-reference and interaction. Used for reference codes (C-1, C-1.1), Risk flag numbers, clause numbers inside source lines, Source sentence captions, links and the "Show clause 9.1 in the contract" link, the 3px focus outline, the primary button's hover fill, the text caret, the underline on a lit sentence, and the Know this glyph and stamp.

### Secondary
- **Red Pencil** (`red`): Don't sign as written only. It appears on that Severity's solid-square glyph and stamp and on the "Red line match" basis label. It is 6.54:1 on paper.

### Tertiary
- **Negotiate Umber** (`amber`): a deep amber-brown that marks the Negotiate glyph and stamp. It is dark enough to hold 7.13:1 on paper at stamp size.

### Neutral
- **Workpaper Sheet** (`sheet`): page background, the header block, the Severity key band, open and hovered flag rows, the Source sentence and Counter-offer boxes, and the active reference chip.
- **Report Paper** (`paper`): framed surfaces that sit on the sheet: the Risk flags pane, the action box, the sign-off block and the full-width contract band.
- **Graphite Ink** (`ink`): all body and heading text, the primary button fill, and the tick mark. It is 14.2:1 on paper.
- **Graphite Soft** (`ink-2`): secondary text such as field labels, pane status, notes, section ledes, counts, clause numbers in the contract and the Counter-offer caption. It is 6.81:1 on sheet.
- **Sage Rule** (`rule`): 1px internal divisions, table cells, chip and count borders, and dashed separators between sibling Risk flags. It is decorative only, at 1.81:1, and never the sole marker of a control or a state.
- **Frame Rule** (`rule-strong`): graphite used as a stroke. It frames documents and sections.
- **Ruling Line** (`ruling`): the faint blue 1px line repeated every 1.9rem on sheet bands.
- **Reference Wash** (`blue-wash`): the fill behind a lit clause in the contract, and text selection.

### Named Rules
**The Red Pencil Rule.** Red means Don't sign as written, or a Red line match that leads to it. It is never used for links, hover, focus, the wordmark, buttons or decoration.

**The Graphite Text Rule.** Severity colour lives on the glyph and the stamp only. Group titles, key labels and Risk flag titles stay graphite.

**The Shape Before Colour Rule.** Every Severity pairs its ink with a distinct glyph, so no state is carried by colour alone.

## Typography

**Display Font:** Source Serif 4 (with Georgia, Times New Roman)
**Body Font:** Archivo (with system-ui, -apple-system, Segoe UI)
**Label Font:** Archivo Narrow 500/600/700 (with Arial Narrow)

**Character:** A book serif set against a plain grotesque. The serif sounds like the contract and the ledger, and the grotesque sounds like the reviewer's notes. The narrow cut does what printed form labels do.

### Hierarchy
- **Display** (600, 3.25rem, 1.04, -0.02em; 2.375rem under 40rem): the single page headline, max 17ch, balanced wrap.
- **Headline** (600, 2.125rem, 1.12, -0.015em): section titles, max 20–24ch, balanced wrap.
- **Title** (Archivo 600, 0.9375rem, 1.35): Risk flag titles.
- **Body** (Archivo 400, 1rem, 1.55): running UI text and explanations, including what a clause says. The lede steps up to 1.125rem/1.6 at 46ch.
- **Document** (Source Serif 4 400, 1.1875rem, 1.65, max 68ch; 1.0625rem/1.6 under 40rem): contract clauses as uploaded.
- **Quote** (Source Serif 4 400, 1rem, 1.5): the Source sentence inside an open Risk flag. The Counter-offer steps down to 0.9375rem, and the truncated source line in a closed row uses 0.875rem/1.35 in `ink-2`.
- **Button** (Archivo 600, 1.0625rem, 1): every "Try it on a document" button.
- **Label** (Archivo Narrow 600, 0.75rem, 0.07em, uppercase): field labels in the header block and sign-off ("Prepared by", "Reviewed by", "Date"). Group titles (700, 0.8125rem), the pane title (700, 1rem, 0.08em) and the headings in the limits list (700, 0.875rem) use the same treatment at their own sizes.
- **Label Stamp** (Archivo Narrow 700, 0.6875rem, 0.08em, uppercase): Severity stamps, box captions ("Counter-offer"), and the basis labels "Red line match" and "Redline's judgment".
- **Numeral** (Archivo Narrow 700, 1.125rem, tabular): Risk flag numbers. Clause numbers use 1rem in `ink-2`.

The wordmark "Redline" is set in Source Serif 4 600 at 1.5rem (1.125rem in the footer), -0.01em, in graphite.

### Named Rules
**The Two Voices Rule.** Words that come from the document, or that are meant to be sent to the Counterparty, are set in serif. That covers clauses, Source sentences and Counter-offers. Redline's own explanation and all controls are set in Archivo.

**The Field Label Rule.** Narrow uppercase text names a field, a stamp, a group or a box. It never sits above a headline as a kicker.

**The Tabular Reference Rule.** Reference codes, Risk flag numbers, clause numbers, counts and status counters all use tabular numerals.

## Layout

The page is a stack of full-width bands inside a 78rem container with 1.5rem side padding (1rem under 40rem). Bands alternate. Ruled sheet bands hold the hero and the sign-off. A white paper band holds the contract, between 2px graphite rules. The limits band sits on plain sheet. The contract always sits on unruled paper.

- **Header block:** a five-field strip (1.5fr 1.5fr 0.8fr 1fr 1fr) that opens a review surface. Under 56rem it becomes a 2-column grid, and its last field spans both columns.
- **Hero:** a text column and the Risk flags pane (1fr / 1.1fr, 2.5rem gap, top-aligned). They stack under 60rem.
- **Aside and body:** section bands pair an 18rem aside (heading, lede, optional quiet button) with a fluid column (3rem gap). The contract aside is sticky at 1.5rem. Both stack under 56rem.
- **Limits list:** two columns separated by 1px rules, with an odd last item spanning both. One column under 40rem.
- **Rhythm:** spacing works in rem steps (0.5, 0.75, 1, 1.5, 2, 3, 4rem). Bands take 4–5rem of block padding. Rows inside components use tighter values (0.6rem, 0.85rem) to keep the report dense.
- **Breakpoints:** 40rem (phone), 48rem (sign-off stacks), 56rem (header block, aside grids), 60rem (hero).

### Named Rules
**The Ruled Sheet Rule.** The 1.9rem ruling appears only on sheet bands. Contract text and framed paper surfaces are never set on ruled lines.

## Elevation & Depth

The system is flat. Depth comes from paper on sheet: a white surface framed by a 1.5px graphite stroke on the pale ruled background. There is one soft, ambient lift, and it belongs to the Risk flags pane, the product's signature surface. Tonal steps, such as sheet fill inside paper for the Source sentence box, the key band and open rows, carry any nesting beyond that. The inset underline on a lit contract sentence is a highlight, not elevation.

### Shadow Vocabulary
- **Pane lift** (`box-shadow: 0 1px 1px rgba(43, 43, 40, 0.06), 0 12px 32px -12px rgba(43, 43, 40, 0.18)`): the Risk flags pane only.
- **Lit sentence underline** (`box-shadow: inset 0 -0.12em 0 var(--blue)`): the Source sentence inside the clause currently linked to an open Risk flag.

### Named Rules
**The Paper On Sheet Rule.** A surface is raised by framing it in paper with a graphite stroke, not by adding a shadow. Only the Risk flags pane casts one.

## Shapes

The forms are square-cornered, like printed forms. Documents, frames, boxes, stamps and counts have no radius. Pressable controls get a barely softened corner: 3px on buttons, 2px on flag rows, reference chips and the focus outline.

Strokes do the structural work, and their weights are fixed:
- **2px graphite:** band boundaries (top bar, contract band, closing band).
- **1.5px graphite:** framed documents (header block, Risk flags pane and its head, action box, sign-off) and the divider before the Outside reference group.
- **1.75px currentColor:** Severity stamps, drawn in the stamp's own ink.
- **1px sage rule:** cells, inner divisions, chip and count borders, Source sentence and Counter-offer boxes.
- **1px dashed sage rule:** between sibling Risk flags inside a Severity group.
- **1px graphite underline:** blank sign-off lines.

The glyphs come from a 20-unit grid. Don't sign as written is a solid square. Negotiate is a ring with its right half filled. Know this is an outlined diamond. Outside reference is a dashed square holding a question mark. Withheld is a ring with a slash. The tick is a hand-drawn pencil stroke on a 24×20 grid with round caps.

### Named Rules
**The Stroke Hierarchy Rule.** Stroke weight states rank: 2px divides the page, 1.5px frames a document, 1px divides within it, dashed separates siblings.

## Components

The components feel like an inspection report filled in by hand: stamped, numbered, ticked and cross-referenced. The pending app shell (.impeccable/surfaces/app-app-layout-js.md) reuses this vocabulary. It also needs inputs (paste or upload, the question box, Red lines) that this build does not contain. Those should be designed inside these rules and recorded on the next pass.

### Buttons
- **Shape:** gently squared corners (3px), 1.5px border matching the fill.
- **Primary:** graphite fill, sheet text, Archivo 600 1.0625rem, padding 0.95rem 1.35rem. It fills the width of the action box and of the stacked sign-off.
- **Hover / Focus:** fill and border shift to Reference Blue over 180ms on the ease-out curve. Active nudges down 1px. Focus is the global 3px blue outline at 3px offset.
- **Quiet:** transparent with a graphite border and graphite text. On hover it takes the graphite fill with sheet text. It is used in section asides.
- **Text link:** blue with a 1px underline at 0.18em offset, thickening to 2px on hover. Top-bar navigation links are graphite with no underline until hover.

### Chips
- **Severity stamp:** uppercase Label Stamp type in the Severity ink, 1.75px currentColor border, square, with a 0.75rem glyph leading the label: "Don't sign as written", "Negotiate", "Know this".
- **Reference chip:** blue tabular code (C-1.1) on paper with a 1px sage border, 2px radius, and a leading pencil tick. Hover and pressed states turn the border blue and the fill sheet over 160ms. `aria-pressed` reflects the linked Risk flag.
- **Basis label:** square 1px currentColor box in Label Stamp type. "Red line match" is red; "Redline's judgment" is graphite.
- **Count:** a small tabular number in `ink-2` inside a 1px sage box, beside a group title.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** paper on the sheet, or sheet inside paper for nested boxes.
- **Shadow Strategy:** none, except the pane lift (see Elevation & Depth).
- **Border:** 1.5px graphite for framed documents; 1px sage for nested boxes.
- **Internal Padding:** 1.25rem for the action box, 1.75rem for the sign-off (1.25rem stacked), 0.5rem 0.75rem for header-block and sign-off cells.
- **Header block:** `dl` fields with a Label above a 500-weight value. The Reference value is blue and tabular.
- **Sign-off:** a headline over a three-field "Prepared by / Reviewed by / Date" strip with blank underlined values, and the primary button aligned to the end.

### Navigation
- **Style:** the serif wordmark on the left and graphite Archivo links at 0.9375rem on the right (1.5rem gap). They sit on the sheet above a 2px graphite rule, with a minimum height of 3.75rem.
- **States:** underline on hover, blue focus outline.
- **Mobile:** links drop to 0.875rem with a 1rem gap and wrap beneath the wordmark. There is no menu toggle.

### Risk Flags Pane (signature)
Inspection-report structure, pinned by the product owner.
- **Head:** the "Risk flags" pane title in narrow uppercase, with a tabular status line in `ink-2` on the right, above a 1.5px graphite rule.
- **Severity key:** a fixed glyph legend on a sheet band. The three Severities form one group, and Outside reference sits in a second group behind a 1px divider (no divider under 40rem). Key labels stay graphite.
- **Groups:** one per Severity in the fixed order Don't sign as written, Negotiate, Know this, each with a glyph, title and count. Risk flags within a group are not ranked. Outside reference follows behind a 1.5px graphite rule.
- **Risk flag row:** a full-width button on a four-column grid: blue tabular number, stamp, title over the truncated source line, and a ticked reference code. Hover and open fill with sheet over 160ms. Under 40rem the stamp moves above the title and the source line clamps to two lines.
- **Open panel:** indented 2.6rem to align under the title. In order it holds: what the clause says (body), the basis label, the **Source sentence box** (sheet fill, 1px sage border, blue caption such as "Source sentence, clause 9.1", serif quote), the **Counter-offer box** (same frame with an `ink-2` caption "Counter-offer", serif wording), and the blue "Show clause 9.1 in the contract" link.

### Tick and Reveal
- **Tick:** a graphite pencil stroke drawn with stroke-dashoffset over 360ms on `cubic-bezier(0.16, 1, 0.3, 1)`. Its source line fades in over 320ms at the same moment.
- **Lit clause:** the linked contract clause takes the blue wash (220ms) and its sentence gets the blue inset underline.
- **Hold from first paint:** an inline script adds `motion` to `<html>` before paint, but only when reduced motion is off and IntersectionObserver exists. Unfound states are held from that point, so nothing is drawn and then erased. Without `motion`, the finished state renders directly.

### Named Rules
**The Found Then Ticked Rule.** A tick is drawn and a source line appears only after that Risk flag's Source sentence has been found. A tick never comes first.

## Do's and Don'ts

### Do:
- **Do** frame every document-like surface in paper or sheet with a 1.5px graphite stroke and square corners.
- **Do** pair each Severity with its glyph: solid square for Don't sign as written, half-filled ring for Negotiate, outlined diamond for Know this, dashed square with a question mark for Outside reference.
- **Do** put a Source sentence box inside every open Risk flag, above its Counter-offer, set in serif with a blue caption naming the clause.
- **Do** set reference codes (C-1, C-1.1), Risk flag numbers, clause numbers and counts in tabular numerals, with codes in Reference Blue.
- **Do** use Archivo Narrow uppercase (0.07–0.08em tracking) for field labels, stamps, group titles and box captions.
- **Do** keep hover and state transitions between 160ms and 360ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and drop them under reduced motion.
- **Do** use the 3px Reference Blue focus outline at 3px offset on every interactive element.

### Don't:
- **Don't** use red for anything except Don't sign as written and a Red line match: no red links, buttons, hovers, focus rings or wordmark.
- **Don't** colour text by Severity. The ink goes on the glyph and the stamp, and labels stay graphite.
- **Don't** carry a Severity, a state or a control boundary by colour or by the sage rule alone.
- **Don't** place a narrow uppercase label above a headline as a kicker or eyebrow.
- **Don't** add hard offset shadows or stack card shadows. The pane lift is the only cast shadow in the system.
- **Don't** fill surfaces or headlines with colour gradients. The only gradient is the 1px ruling pattern on sheet bands.
- **Don't** round documents, boxes or stamps. Radius stops at 3px, on pressable controls.
- **Don't** set contract text or framed paper on ruled lines.
- **Don't** replace the drawn SVG glyphs and pencil tick with emoji, font glyphs or stock icon sets.
- **Don't** set Redline's explanation in serif or the contract's words in sans.
- **Don't** add motion that does not report a state change.
