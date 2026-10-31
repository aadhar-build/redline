// Every string the Reviewer reads on the paste-and-summarise screen. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

// "Page 3", "Pages 2 and 5", "Pages 1, 2 and 4", "Pages 1 to 40 and 52". Runs of three or more
// consecutive pages become a range, so a long scan does not produce a list of hundreds of numbers.
export function pageList(pages) {
  const parts = [];
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    if (j - i >= 2) parts.push(`${pages[i]} to ${pages[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(pages[k]));
    i = j + 1;
  }
  if (pages.length === 1) return `Page ${parts[0]}`;
  return parts.length === 1 ? `Pages ${parts[0]}` : `Pages ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export const COPY = {
  pageTitle: "Upload or paste a contract",
  pageLede:
    "Choose a PDF or Word file, or paste the text. Your browser pulls the text out of the file. Redline writes a plain-English summary and flags the clauses to raise, each one next to the sentence it came from.",
  fileLabel: "Contract file",
  fileHint: "A PDF or Word (.docx) file. Your browser reads the text out of it, and the file never leaves this browser.",
  fileReading: "Reading the file…",
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
  // pages: 1-based page numbers, at least one.
  scannedPages: (pages) =>
    `${pageList(pages)} of this file ${pages.length === 1 ? "is" : "are"} scanned, and Redline can't read scanned pages yet, so it hasn't sent anything. If you have a copy where you can select the text, use that, or paste the text in.`,
  submit: "Review",
  submitBusy: "Reading the contract…",
  summaryCaption: "Plain-English summary",
  summaryNote: "This only restates what the contract says. It doesn't tell you whether to sign.",
  markedNote:
    "Redline isn't supposed to use the highlighted words, because they hedge or pass judgment the contract doesn't back up. Check those parts against the contract.",
  // Ticket 22, ruling C(b): numbers in Redline's own text that the contract doesn't contain.
  numberNote: "The highlighted numbers aren't in the contract. Check them against the contract before you rely on them.",
  // Ticket 22, ruling C(a).
  templateNote:
    "This looks like a blank form with gaps still to fill in. Redline describes what the form provides for, not what anyone has agreed to or signed.",
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
      "unsupported-number": (n, total) =>
        total === 1 ? "It gave a number the contract doesn't contain." : `${n} gave a number the contract doesn't contain.`,
      // Ticket 13: an Outside reference Redline found but couldn't cut into whole sentences.
      "reference-not-citable": (n, total) =>
        total === 1
          ? "It's a reference to another document that Redline couldn't cite as a whole sentence, such as a line in a contents list."
          : `${n} are references to other documents that Redline couldn't cite as whole sentences, such as lines in a contents list.`,
    },
    severityNote: "The level on each flag is Redline's judgment, not something the contract says.",
    withheldTail: "Redline doesn't show a flag it can't trace to the contract.",
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
      "A Counter-offer should only restate or tighten terms already in the contract. Redline can't check whether it adds a new term, so read it against the contract before you send it.",
    markedNote: "Counter-offers aren't allowed to use the highlighted words, because they hedge. Reword them before you send it.",
    numberNote:
      "The highlighted numbers in Counter-offers aren't in the contract. Tightening a term can change a figure, so check each one is what you want to ask for.",
  },
  // A Clean result (ADR 0006): said plainly, with every Red line checked and any Know this flags beneath.
  // Never "safe", "fine" or "good to sign"; a unit test runs the verdict-word check over these strings.
  clean: {
    title: "Clean result",
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
    signInToMark: "To mark this as reviewed, sign in and review the contract again. Redline only keeps that mark on a saved review.",
    errors: {
      "not-found": "Redline couldn't find this reference on your saved review. Reload the page and try again.",
      "signed-out": "Your session has ended. Sign in again to mark this as reviewed.",
      failed: "Redline couldn't save that. Try again.",
    },
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
    password: "This file is locked with a password. Save a copy without the password and use that.",
    unreadable: "Redline couldn't open this file. It might be damaged. Try saving it again, or paste the text in.",
    "no-text": "This file has no text for Redline to read.",
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
