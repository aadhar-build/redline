// Every string the Reviewer reads on the paste-and-summarise screen. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

export const COPY = {
  pageTitle: "Paste a contract",
  pageLede: "Redline reads the text and writes a plain-English summary of what the contract says.",
  fieldLabel: "Contract text",
  fieldHint: "Paste the whole contract.",
  submit: "Summarise",
  submitBusy: "Reading the contract…",
  summaryCaption: "Plain-English summary",
  summaryNote: "This only restates what the contract says. It doesn't tell you whether to sign.",
  emptyState: "Paste a contract and press Summarise. The summary appears here.",
  unavailableTitle: "Analysis is off on this site",
  unavailableBody:
    "For now Redline only reads contracts on one test machine, so you can't summarise a contract here yet.",
  errors: {
    "empty-document": "Paste the contract text first.",
    "document-too-long": "That's too much text to read in one go. The limit is 200,000 characters.",
    "banned-wording":
      'Redline held this summary back because it used words Redline doesn\'t allow, such as "may" or "safe". Try again.',
    "unreadable-output": "Redline couldn't read the summary it got back. Try again.",
    "no-script":
      "This local setup only has a scripted summary for the sample contract in fixtures/contracts. Paste that one.",
    failed: "Redline couldn't finish reading the contract. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
  },
};
