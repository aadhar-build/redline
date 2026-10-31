// Every string the Reviewer reads on the Red lines screen (ticket 12). Run through the humanizer skill
// before commit (CLAUDE.md). Safe to import from client code: it holds text only.

export const RED_LINES_COPY = {
  nav: "Red lines",
  pageTitle: "Your Red lines",
  lede: "A Red line is a term the business won't accept. Redline checks every contract you review while signed in against this list, and a clause that matches one is always Don't sign as written. Your list starts with Redline's four Default Red lines. Change it here and your next review uses the new list. Reviews already in your library keep the list they were checked against, and you can review any of them again with the new list.",
  off: "Accounts are switched off on this site, so there are no saved Red lines here.",
  listLabel: "Red lines",
  defaultLabel: (n) => `Default Red line ${n}`,
  ownLabel: "Your Red line",
  basisLabel: "Basis",
  editedNote: (n) =>
    `You reworded Default Red line ${n}, so Redline now checks for your wording. Its basis covered the original wording only, so Redline doesn't show it here.`,
  edit: "Edit",
  editLabel: (label) => `Edit ${label}`,
  save: "Save",
  saveBusy: "Saving…",
  cancel: "Cancel",
  remove: "Remove",
  removeLabel: (label) => `Remove ${label}`,
  empty: "Your list is empty, so Redline won't mark any clause as a Red line match. Add one below.",
  addLabel: "Add a Red line",
  addHint: "Write it in your own words: one sentence about a term the business won't accept. Redline sends it to the model with each contract, and each match it finds names this Red line.",
  addSubmit: "Add Red line",
  removedTitle: "Default Red lines you removed",
  removed: (n, name) =>
    `You removed Default Red line ${n}: ${name}. Redline no longer checks contracts for it, so a clause it would have caught isn't a Red line match any more and isn't always Don't sign as written. That clause gets a Severity like any other, and a common version of it can come back at a lower level.`,
  errors: {
    "empty-red-line": "Write the Red line first.",
    "red-line-too-long": "That's too long for one Red line. Keep it to 300 characters or fewer.",
    "too-many-red-lines": "The list is full at 30 Red lines. Remove one before you add another.",
    "not-found": "That Red line isn't on your list any more. The page now shows the list as it stands.",
    "signed-out": "You're signed out. Sign in again to change your Red lines.",
    failed: "Redline couldn't save that change. Try again.",
    network: "Couldn't reach Redline. Check your connection and try again.",
  },
};
