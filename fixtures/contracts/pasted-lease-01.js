// Pasted-text fixture for the Source sentence check (research 09, section 7: pasted text with NBSP and
// U+200B). Kept as a JS string so the invisible characters are written as escapes and stay reviewable:
// a no-break space in "Rs. 40,000", curly quotes and a curly apostrophe, a zero-width space and an em
// dash in clause 4, and single line breaks between clauses, as text pasted from an email arrives.
// Every name in it is made up.

export const PASTED_LEASE_01 = [
  "COMMERCIAL LEASE",
  "",
  "This Lease is made on 5 January 2027 between Saffron Estates LLP (\u201CLandlord\u201D) and Banyan Print Works (\u201CTenant\u201D). Every name in this document is made up for testing Redline.",
  "1. Rent. Tenant shall pay the Rent of Rs.\u00A040,000 on or before the 5th day of each month.",
  "2. Notice. Either party may end this Lease by giving the other 30 days\u2019 written notice.",
  "3. Deposit. Landlord shall refund the Security Deposit within 30 days after the Lease ends, unless Tenant owes unpaid Rent.",
  "4. Repairs. Landlord is not responsible for repairs to the Premises\u200B \u2014 Tenant pays for all of them.",
  "5. Use. The Premises shall be used only as a printing shop.",
  "",
].join("\n");

// Quotes as a model returns them: straight quotes, plain spaces, a hyphen for the dash. Each must be found.
export const PASTED_LEASE_01_FOUND = [
  'This Lease is made on 5 January 2027 between Saffron Estates LLP ("Landlord") and Banyan Print Works ("Tenant").',
  "Tenant shall pay the Rent of Rs. 40,000 on or before the 5th day of each month.",
  "Either party may end this Lease by giving the other 30 days' written notice.",
  "Landlord is not responsible for repairs to the Premises - Tenant pays for all of them.",
  // Two whole sentences in a row are one span.
  "Landlord shall refund the Security Deposit within 30 days after the Lease ends, unless Tenant owes unpaid Rent. 4. Repairs.",
  "The Premises shall be used only as a printing shop.",
];

// The section 7 negative cases that apply to pasted text, and a few more. Each must be withheld.
export const PASTED_LEASE_01_ALTERED = {
  "30 changed to 60": "Either party may end this Lease by giving the other 60 days' written notice.",
  '"shall" changed to "may"': "The Premises may be used only as a printing shop.",
  '"not" dropped': "Landlord is responsible for repairs to the Premises - Tenant pays for all of them.",
  "defined term's case changed": "Tenant shall pay the rent of Rs. 40,000 on or before the 5th day of each month.",
  'trailing "unless" qualifier dropped': "Landlord shall refund the Security Deposit within 30 days after the Lease ends.",
  "qualifier dropped, no full stop": "Landlord shall refund the Security Deposit within 30 days after the Lease ends",
  "two clauses spliced with an ellipsis":
    "Landlord shall refund the Security Deposit within 30 days ... unless Tenant owes unpaid Rent.",
  "spliced with an ellipsis character": "Tenant shall pay the Rent of Rs. 40,000\u2026 each month.",
  "starts mid-sentence": "Tenant pays for all of them.",
  "stops at an abbreviation": "Tenant shall pay the Rent of Rs.",
  "invented sentence": "Tenant personally guarantees the Rent.",
  "wrapped in quote marks": "\u201CThe Premises shall be used only as a printing shop.\u201D",
};
