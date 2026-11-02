// Every string the Reviewer reads on the paste-and-summarise screen. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

export const COPY = {
  pageTitle: "Upload or paste a contract",
  pageLede:
    "Choose a PDF or Word file, or paste the text. Your browser pulls the text out of the file. Redline writes a plain-English summary and flags the clauses to raise, each one next to the sentence it came from.",
  fileLabel: "Contract file",
  fileHint:
    "A PDF or Word (.docx) file. Your browser reads the text out of it, including scanned pages, and the file never leaves this browser.",
  fileReading: "Reading the file…",
  // While OCR reads the pages without a text layer (ADR 0008). done: pages finished, total: OCR pages.
  ocrProgress: (done, total) =>
    total === 1 ? "Reading the scanned page…" : `Reading scanned page ${Math.min(done + 1, total)} of ${total}…`,
  ocrCancel: "Stop",
  ocrCancelled: "Reading stopped. Redline hasn't sent anything.",
  fileLoaded: (name) => `Text from ${name}. Check it, then press Review.`,
  clearFile: "Remove file",
  // Shown when a Word file has hidden text (w:vanish) with a letter or digit in it (ticket 21).
  hiddenText: "This file has text that Word hides, and Redline didn't read it.",
  // Shown when a PDF's running headers or page numbers were left out (QUESTIONS.md 19).
  // removed: [{ text, count }], at least one; names up to five distinct strings.
  removedLines: (removed) => {
    const total = removed.reduce((n, r) => n + r.count, 0);
    const named = removed.slice(0, 5).map((r) => `"${r.text}"`);
    const more = removed.length - named.length;
    const list =
      more > 0
        ? `${named.join(", ")} and ${more} more`
        : named.length === 1
          ? named[0]
          : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
    return total === 1
      ? `Redline left out 1 line it read as a running header or page number: ${list}.`
      : `Redline left out ${total} lines it read as running headers or page numbers: ${list}.`;
  },
  fieldLabel: "Contract text",
  fieldHint: "Paste the whole contract, or choose a file above.",
  submit: "Review",
  submitBusy: "Reading the contract…",
  summaryCaption: "Plain-English summary",
  summaryNote: "This only restates what the contract says. It doesn't tell you whether to sign.",
  markedNote:
    "Redline isn't supposed to use the highlighted words, because they hedge or pass judgment the contract doesn't back up. Check those parts against the contract.",
  // Ticket 22, ruling C(b): numbers in Redline's own text that the contract doesn't contain.
  numberNote: "The highlighted numbers aren't in the contract. Check them against the contract before you rely on them.",
  // QUESTIONS 18 (decided 2026-10-31): shown on any review whose document OCR read, in whole or part.
  // scanned: { pages, pageCount } from the review; pages or pageCount may be null (unknown).
  scannedNote: ({ pages, pageCount }) => {
    const tail = "Redline can misread a scan, so check any word or number you rely on against the original.";
    if (pages == null) return `Redline read part of this document from a scan. ${tail}`;
    if (pageCount != null && pages === pageCount) {
      return pages === 1
        ? `Redline read this one-page document from a scan. ${tail}`
        : `Redline read all ${pages} pages of this document from a scan. ${tail}`;
    }
    if (pageCount != null) return `Redline read ${pages} of this document's ${pageCount} pages from a scan. ${tail}`;
    return `Redline read ${pages} ${pages === 1 ? "page" : "pages"} of this document from a scan. ${tail}`;
  },
  // Ticket 22, ruling C(a), worded by ticket 24 ruling 22: blanks, never "an unsigned form".
  templateNote:
    "This document has blanks that haven't been filled in. Redline calls it signed or dated only where the document itself says so.",
  // Ticket 22, ruling E.
  owner: {
    label: "Reviewed for:",
    unknown: "Redline couldn't tell which party you're on.",
    change: "Change",
    pickLabel: "Which party are you?",
    submit: "Review again",
    cancel: "Cancel",
  },
  emptyState: "Choose a file or paste a contract, then press Review. The summary and Risk flags appear here.",
  unavailableTitle: "Analysis is off on this site",
  unavailableBody:
    "For now Redline only reads contracts on one test machine, so you can't review a contract here yet.",
  flags: {
    title: "Risk flags",
    status: (n) =>
      n === 0
        ? "No flags shown"
        : n === 1
          ? "1 flag. Its sentence was found in the contract."
          : `${n} flags. Every sentence was found in the contract.`,
    keyLabel: "Key",
    foundKey: "Sentence found in the contract",
    judgmentLabel: "Redline's judgment",
    withheldTitle: (n) => (n === 1 ? "1 Risk flag withheld." : `${n} Risk flags withheld.`),
    // The second argument is the total withheld; when it is 1, the sentence reads "It ...".
    withheldReason: {
      "source-not-found": (n, total) =>
        total === 1 ? "It quoted a sentence the contract doesn't contain." : `${n} quoted a sentence the contract doesn't contain.`,
      "no-source": (n, total) =>
        total === 1 ? "It came back without a Source sentence." : `${n} came back without a Source sentence.`,
      unreadable: (n, total) =>
        total === 1 ? "It came back in a form Redline couldn't read." : `${n} came back in a form Redline couldn't read.`,
      // spec-gaps 24, research 31: a cited OCR sentence with a misread amount or clause number (lib/review/unreadable-amount.js).
      "unreadable-amount": (n, total) =>
        total === 1
          ? "It quoted a sentence from a scanned page where Redline couldn't make out an amount or a clause number."
          : `${n} quoted sentences from scanned pages where Redline couldn't make out an amount or a clause number.`,
      "unsupported-number": (n, total) =>
        total === 1 ? "It gave a number the contract doesn't contain." : `${n} gave a number the contract doesn't contain.`,
      // QUESTIONS.md 37: on an earlier review, a flag from a document the Reviewer has since removed.
      "referenced-document-removed": (n, total) =>
        total === 1 ? "It came from a document you later removed." : `${n} came from a document you later removed.`,
      // Ticket 13: an Outside reference Redline found but couldn't cut into whole sentences.
      "reference-not-citable": (n, total) =>
        total === 1
          ? "It's a reference to another document that Redline couldn't cite as a whole sentence, such as a line in a contents list."
          : `${n} are references to other documents that Redline couldn't cite as whole sentences, such as lines in a contents list.`,
    },
    severityNote: "The level on each flag is Redline's judgment, not something the contract says.",
    merged: (n) =>
      n === 1
        ? "1 flag merged into an Outside reference. It cited the same sentence for the same Red line, so Redline shows it once."
        : `${n} flags merged into Outside references. Each cited the same sentences for the same Red line, so Redline shows each sentence once.`,
    withheldTail: "Redline doesn't show a flag it can't trace to the contract.",
    // Ticket 24 ruling 23(c).
    judgmentsDropped: (n) =>
      n === 1
        ? "Redline left out 1 of its judgments because it said what's usual, which the contract doesn't show."
        : `Redline left out ${n} of its judgments because they said what's usual, which the contract doesn't show.`,
    sourceCaption: "Source sentence",
    sourceCaptionOf: (i, n) => `Source sentence ${i} of ${n}`,
    // Shown only when no flags came back and the review is still not a Clean result.
    none: "No Risk flags came back for this contract.",
    redLineMatchLabel: "Red line match",
    redLineMatched: (number, name) => `Red line ${number}: ${name}`,
    unreadable: "Redline couldn't read the Risk flags it got back, so it isn't showing any. Try again.",
    emptyGroup: "None at this level.",
  },
  // Ticket 07: an Ambiguous clause and its readings, none chosen.
  ambiguous: {
    label: "Ambiguous clause",
    lede: "This clause can be read more than one way. Redline lists each reading without picking one.",
    readingCaption: (i, n) => `Reading ${i} of ${n}`,
  },
  // Tickets 08 and 17.
  counterOffer: {
    caption: "Counter-offer",
    copy: "Copy",
    copied: "Copied",
    copyLabel: (n) => `Copy Counter-offer for flag ${n}`,
    copyFailed: "Couldn't copy the wording. Select it and copy it yourself.",
    missing: "Redline has no Counter-offer for this flag.",
    note:
      "A Counter-offer should only restate or tighten terms already in the contract. Redline highlights words the contract doesn't use, but it can't catch every new term, so read it against the contract before you send it.",
    markedNote: "Counter-offers aren't allowed to use the highlighted words, because they hedge. Reword them before you send it.",
    newTermNote:
      "The highlighted words in Counter-offers aren't in the contract. Each one can bring in a term the contract doesn't have, so check them before you send it.",
    // Ticket 08b: the model's note naming a term the contract lacks. Never shown as proposed wording.
    needsNewTerm: {
      lead: "Redline's judgment: the contract has no ",
      tail: ". Adding one would be a new term, so this Counter-offer leaves it out.",
    },
    numberNote:
      "The highlighted numbers in Counter-offers aren't in the contract. Tightening a term can change a figure, so check each one is what you want to ask for.",
  },
  // A Clean result (ADR 0006): said plainly, with every Red line checked and any Know this flags beneath.
  // Never "safe", "fine" or "good to sign"; a unit test runs the verdict-word check over these strings.
  clean: {
    title: "Clean result",
    noClauses: "This doesn't look like a contract with terms, so Redline can't call it Clean.",
    statement:
      "This contract has a Clean result. No clause came back as Don't sign as written or Negotiate, and none matches a Red line on your list.",
    checkedLede: "Redline checked the contract against each of these Red lines, and no clause matched any of them.",
    noRedLines: "Your Red line list was empty when Redline read this contract, so there was nothing to check it against.",
    knowThisLede: "These clauses are worth knowing about. Each one shows the sentence it came from.",
    noKnowThis: "There are no Know this flags either.",
    // (The held-back message is retired: tickets 13 and 07 landed and the gate is lifted.)
    // Under a Clean result whose Outside references the Reviewer marked as reviewed.
    outsideReviewed:
      "You marked each Outside reference below as reviewed. That's your own statement. Redline hasn't read the documents they point to.",
    outsideMarkedSome:
      "Redline reviewed the documents you added together with this contract. You marked the other Outside references below as reviewed yourself, and Redline hasn't read the documents they point to.",
    outsideAdded: "You added the document for each Outside reference below, and Redline reviewed them together with this contract.",
    // Which note goes with a Clean result: the Reviewer's marks, the added documents, or both.
    outsideNote(references) {
      const added = references.filter((r) => r.addedDocument).length;
      if (added === 0) return this.outsideReviewed;
      return added === references.length ? this.outsideAdded : this.outsideMarkedSome;
    },
  },
  // Outside references (ticket 13, ADR 0007). Marking one as reviewed is the Reviewer's statement, never
  // something Redline checked, and every line here says so.
  outside: {
    keyLabel: "Outside reference",
    title: "Outside references",
    lede: "These sentences bring in terms from documents Redline wasn't given, so it hasn't read those terms.",
    notReviewedTag: "Not reviewed",
    reviewedTag: "You marked this reviewed",
    notReviewed: "You haven't marked this as reviewed, so this contract can't get a Clean result yet.",
    statementLabel: "Your statement",
    statement: (when) =>
      when
        ? `You marked this as reviewed on ${when}. Redline hasn't read the referenced terms.`
        : "You marked this as reviewed. Redline hasn't read the referenced terms.",
    stillBlocks:
      "This one matches a Red line, so it still stops a Clean result after you mark it reviewed.",
    mark: "Mark as reviewed",
    unmark: "Undo",
    markBusy: "Saving…",
    sourcesCaption: "Source sentences",
    markCovers: (n) => `Marking this covers all ${n} sentences.`,
    signInToMark: "To mark this as reviewed, sign in and review the contract again. Redline only keeps that mark on a saved review.",
    errors: {
      "not-found": "Redline couldn't find this reference on your saved review. Reload the page and try again.",
      "signed-out": "Your session has ended. Sign in again to mark this as reviewed.",
      failed: "Redline couldn't save that. Try again.",
    },
    // Ticket 18: adding the document a reference brings in.
    add: {
      open: "Add the referenced document",
      hint: "Upload the PDF or Word file, or paste its text. Redline reads the file here in your browser and sends only the text, then reviews it together with this contract.",
      fileLabel: "File",
      pasteLabel: "Or paste its text",
      submit: "Review them together",
      busy: "Reviewing both…",
      errors: {
        "already-added": "You've already added a document for this reference. Remove it first to add a different one.",
        "not-found": "Redline couldn't find this reference on your saved review. Reload the page and try again.",
        "signed-out": "Your session has ended. Sign in again to add the document.",
        incomplete: "Redline couldn't finish reviewing the two together, so it didn't keep the document. Try again.",
        unavailable: "Reviewing isn't available on this site, so you can't add the document here.",
        failed: "Redline couldn't review the two together. Try again.",
      },
    },
    // QUESTIONS.md 40: one cap for the contract and everything added to it.
    tooLongTogether: (left) =>
      `This contract and its added documents can total 200,000 characters. About ${left} are left.`,
    // QUESTIONS.md 37: removing an added document. Replacing one is Remove, then Add.
    remove: {
      button: "Remove this document",
      busy: "Removing…",
      errors: {
        "not-found": "Redline couldn't find that document on your saved review. Reload the page and try again.",
        "signed-out": "Your session has ended. Sign in again to remove the document.",
        incomplete: "Redline couldn't finish reviewing the contract without it, so it kept the document. Try again.",
        unavailable: "Reviewing isn't available on this site, so you can't remove the document here.",
        failed: "Redline couldn't remove the document. Try again.",
      },
    },
    // QUESTIONS.md 39: a document added against an "as amended" reference that matches a Red line.
    addedStillBlocks: (number) =>
      `This one still stops a Clean result. The other side can change these terms after the contract is signed, which matches Red line ${number}.`,
    // QUESTIONS.md 36: a reference inside a document the Reviewer added.
    inAdded: (title) => (title ? `In "${title}", a document you added` : "In a document you added"),
    addedTag: "Document added",
    added: (title) =>
      `You added ${title ? `"${title}"` : "the referenced document"}. Redline reviewed it together with this contract. Any flags from it are listed with the others, each quoting its own sentence.`,
    fromReferenced: (title) => (title ? `From "${title}", the document you added` : "From the document you added"),
  },
  // Ticket 20: Copy all as text. Marked words are wrapped in square brackets in the copied text.
  copyAll: {
    button: "Copy all as text",
    copied: "Copied",
    status: "Copied the whole review.",
    failed: "Couldn't copy the review. Select the text and copy it yourself.",
    bracketKey: "Words in [square brackets] are highlighted on screen.",
  },
  redLines: {
    title: "Red lines checked",
    lede: "Redline checked this contract against each of these. A clause that matches one is always Don't sign as written.",
    basisLabel: "Basis",
  },
  errors: {
    "empty-document": "Paste the contract text first.",
    "not-english":
      "Redline only reads contracts written in English for now, and this one doesn't look like English. It hasn't sent anything.",
    "unsupported-type":
      "Redline reads PDF and Word .docx files. If it's an older .doc file, save it as .docx in Word first, or paste the text in.",
    "too-large": "That file is over 100 MB, too big to read here.",
    "too-many-pages": "That PDF has more than 300 pages, and 300 is the limit. Paste in the part you need, or split the file.",
    password: "This file is locked with a password. Save a copy without the password and use that.",
    unreadable: "Redline couldn't open this file. It might be damaged. Try saving it again, or paste the text in.",
    "no-text": "This file has no text for Redline to read.",
    "ocr-failed":
      "Redline couldn't read the scanned pages in this file, so it hasn't sent anything. Try again, or paste the text in.",
    "document-too-long": "That's too much text to read in one go. The limit is 200,000 characters.",
    "unreadable-output": "Redline couldn't read the summary it got back. Try again.",
    "no-script":
      "This local setup only has scripted reviews for the sample contracts in fixtures/contracts. Paste one of those.",
    busy: "Redline is already reading a contract. Try again when it's done.",
    "bad-owner-party": "Pick one of the parties named in the contract.",
    failed: "Redline couldn't finish reading the contract. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
    "save-failed": "Redline couldn't save the contract to your library, so it didn't review it. Try again.",
    "bad-red-lines":
      "One of your Red lines couldn't be read, so Redline didn't review the contract. Check the list on the Red lines page, then try again.",
    "red-lines-failed": "Redline couldn't load your Red lines, so it didn't review the contract. Try again.",
  },
};
