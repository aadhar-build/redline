// Every string the Reviewer reads on the paste-and-summarise screen. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

export const COPY = {
  pageTitle: "Paste a contract",
  pageLede:
    "Redline reads the text, writes a plain-English summary and flags the clauses to raise, each one next to the sentence it came from.",
  fieldLabel: "Contract text",
  fieldHint: "Paste the whole contract.",
  submit: "Review",
  submitBusy: "Reading the contract…",
  summaryCaption: "Plain-English summary",
  summaryNote: "This only restates what the contract says. It doesn't tell you whether to sign.",
  markedNote:
    "Redline isn't supposed to use the highlighted words, because they hedge or pass judgment the contract doesn't back up. Check those parts against the contract.",
  emptyState: "Paste a contract and press Review. The summary and Risk flags appear here.",
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
    },
    withheldTail: "Redline doesn't show a flag it can't trace to the contract.",
    sourceCaption: "Source sentence",
    sourceCaptionOf: (i, n) => `Source sentence ${i} of ${n}`,
    none:
      "No Risk flags came back for this contract. This isn't a Clean result, because Redline doesn't check your Red lines or Outside references yet.",
    unreadable: "Redline couldn't read the Risk flags it got back, so it isn't showing any. Try again.",
    emptyGroup: "None at this level.",
  },
  errors: {
    "empty-document": "Paste the contract text first.",
    "document-too-long": "That's too much text to read in one go. The limit is 200,000 characters.",
    "unreadable-output": "Redline couldn't read the summary it got back. Try again.",
    "no-script":
      "This local setup only has scripted reviews for the sample contracts in fixtures/contracts. Paste one of those.",
    busy: "Redline is already reading a contract. Try again when it's done.",
    failed: "Redline couldn't finish reading the contract. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
  },
};
