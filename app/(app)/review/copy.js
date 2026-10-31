// Every string the Reviewer reads on the paste-and-summarise screen. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

// "Page 3", "Pages 2 and 5", "Pages 1, 2 and 4".
export function pageList(pages) {
  if (pages.length === 1) return `Page ${pages[0]}`;
  return `Pages ${pages.slice(0, -1).join(", ")} and ${pages[pages.length - 1]}`;
}

export const COPY = {
  pageTitle: "Upload or paste a contract",
  pageLede:
    "Choose a PDF or Word file, or paste the text. Your browser pulls the text out of the file, and Redline writes a plain-English summary of what the contract says.",
  fileLabel: "Contract file",
  fileHint: "A PDF or Word (.docx) file. Your browser reads the text out of it, and the file never leaves this browser.",
  fileReading: "Reading the file…",
  fileLoaded: (name) => `Text from ${name}. Check it, then press Summarise.`,
  clearFile: "Remove file",
  fieldLabel: "Contract text",
  fieldHint: "Paste the whole contract, or choose a file above.",
  // pages: 1-based page numbers, at least one.
  scannedPages: (pages) =>
    `${pageList(pages)} of this file ${pages.length === 1 ? "is" : "are"} scanned, and Redline can't read scanned pages yet, so it hasn't sent anything. If you have a copy where you can select the text, use that, or paste the text in.`,
  submit: "Summarise",
  submitBusy: "Reading the contract…",
  summaryCaption: "Plain-English summary",
  summaryNote: "This only restates what the contract says. It doesn't tell you whether to sign.",
  markedNote:
    "Redline isn't supposed to use the highlighted words, because they hedge or pass judgment the contract doesn't back up. Check those parts against the contract.",
  emptyState: "Choose a file or paste a contract, then press Summarise. The summary appears here.",
  unavailableTitle: "Analysis is off on this site",
  unavailableBody:
    "For now Redline only reads contracts on one test machine, so you can't summarise a contract here yet.",
  errors: {
    "empty-document": "Paste the contract text first.",
    "not-english":
      "Redline only reads contracts written in English for now, and this one doesn't look like English. It hasn't sent anything.",
    "unsupported-type":
      "Redline reads PDF and Word .docx files. If it's an older .doc file, save it as .docx in Word first, or paste the text in.",
    "too-large": "That file is over 50 MB, too big to read here.",
    password: "This file is locked with a password. Save a copy without the password and use that.",
    unreadable: "Redline couldn't open this file. It might be damaged. Try saving it again, or paste the text in.",
    "no-text": "This file has no text for Redline to read.",
    "document-too-long": "That's too much text to read in one go. The limit is 200,000 characters.",
    "unreadable-output": "Redline couldn't read the summary it got back. Try again.",
    "no-script":
      "This local setup only has a scripted summary for the sample contract in fixtures/contracts. Paste that one.",
    failed: "Redline couldn't finish reading the contract. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
  },
};
