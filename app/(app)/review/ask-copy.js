// Every string the Reviewer reads in the question box. Run through the humanizer skill before commit
// (CLAUDE.md). Safe to import from client code: it holds text only.

export const ASK_COPY = {
  title: "Ask about this contract",
  fieldLabel: "Your question",
  fieldHint: "Redline answers from this contract's text only.",
  submit: "Ask",
  submitBusy: "Checking the contract\u2026",
  emptyState: "Ask about the contract you pasted. Answers come only from its text and show the sentences they rely on.",
  answerCaption: "Answer",
  sourceCaption: "Source sentence",
  answerNote:
    "Every answer quotes the sentences it rests on. Redline checks each one against the contract word for word before showing the answer.",
  notInDocument: "The contract doesn't answer this. Redline answers only from the contract, not from general knowledge.",
  markedNote:
    "Redline isn't supposed to use the highlighted words, because they hedge or pass judgment the contract doesn't back up. Check those parts against the contract.",
  withheld: {
    "source-not-found":
      "Redline drafted an answer but couldn't find the sentences it quoted in the contract, so it isn't showing it. Try asking another way.",
    "unreadable-output": "Redline couldn't read the answer it got back. Try again.",
  },
  errors: {
    "empty-question": "Type a question first.",
    "question-too-long": "That question is too long. Keep it under 1,000 characters.",
    "empty-document": "Paste the contract text first.",
    "document-too-long": "That's too much text to read in one go. The limit is 200,000 characters.",
    "no-script":
      "This local setup only has scripted answers for the questions in fixtures/questions. Ask one of those.",
    failed: "Redline couldn't answer that. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
  },
};
