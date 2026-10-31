// Every string the Reviewer reads about accounts and the saved library. Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

export const LIBRARY_COPY = {
  nav: {
    label: "Account",
    review: "Paste a contract",
    library: "Library",
    signIn: "Sign in",
    signOut: "Sign out",
  },
  signIn: {
    pageTitle: "Sign in",
    lede: "Redline emails you a sign-in link, so there's no password. Contracts you review while signed in go to your library, and no other account can read them.",
    emailLabel: "Email address",
    submit: "Email me a link",
    submitBusy: "Sending…",
    sent: (email) => `Link sent to ${email}. Open it in this browser to sign in. It works once and expires after an hour.`,
    off: "Accounts are switched off on this site, so there's nothing to sign in to.",
    errors: {
      empty: "Enter your email address first.",
      invalid: "That isn't an email address. Check it and try again.",
      failed: "Redline couldn't send the link. Wait a minute and try again.",
      link: "That sign-in link didn't work. Each link works once, for an hour, and only in the browser that asked for it. Ask for a new one below.",
    },
  },
  library: {
    pageTitle: "Library",
    lede: "Every contract you reviewed while signed in, newest first. Opening one shows the review as it was saved. Redline doesn't read the contract again.",
    empty: "Your library is empty. Review a contract while you're signed in and it shows up here.",
    emptyAction: "Paste a contract",
    columns: { document: "Document", saved: "Saved", flags: "Risk flags" },
    untitled: "Untitled contract",
    flagCount: (n) => (n === null ? "No review" : String(n)),
    off: "Accounts are switched off on this site, so there's no library here.",
  },
  saved: {
    fields: { document: "Document", source: "Text from", saved: "Saved" },
    sourceKinds: { pasted: "Pasted text", pdf: "PDF file", docx: "DOCX file" },
    note: "This is the review as it was saved, and Redline hasn't read the contract again. It checked each Source sentence against the saved text when this page opened.",
    noReview: "There's no saved review for this contract.",
    askOff: "Questions are switched off on this site. For now Redline only reads contracts on one test machine.",
    back: "Back to the library",
    notFoundTitle: "Not in your library",
    notFound: "Redline can't find that contract in your library.",
  },
  paste: {
    saved: "Saved to your library.",
    savedLink: "Open the saved copy",
    notSaved: "Redline couldn't read part of this review, so it didn't save it. Review the contract again to save it.",
    signedOut: "You aren't signed in, so this review won't be saved.",
    signedOutLink: "Sign in to save reviews",
  },
};
