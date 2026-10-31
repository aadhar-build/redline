// Extraction-shaped fixtures for the Source sentence check (research 09, section 7; ADR 0010).
// Each is the stored text as an extractor would hand it over, written as a JS string so line breaks
// and invisible characters stay reviewable. They are not produced by the real PDF or DOCX extraction
// (ticket 05); they copy what research 09 says pdf.js and a mammoth-style raw-text reader emit.
// Every name in them is made up.

// pdf.js text, with each hasEOL written as "\n": headings on their own lines, a letter-spaced heading,
// a wrapped sentence, a line-end hyphen in a plain word and in a compound, an fi ligature, a
// superscript footnote marker read as a digit, two columns read line by line across each other, and a
// sentence that crosses a page footer.
export const PDF_SHAPED_01 = [
  "SERVICES AGREEMENT",
  "N O T I C E",
  "This Agreement is made between Kestrel Analytics Private Limited (the “Supplier”) and Marigold Foods LLP (the “Client”).",
  "1. Fees",
  "The Client shall pay the Supplier Rs. 75,000 per month within 30",
  "days of each invoice, unless the Client disputes the invoice in writing.",
  "The Supplier may termi-",
  "nate this Agreement on 15 days’ notice.",
  "The Supplier shall not engage any sub-",
  "contractor without the Client’s written consent.",
  "The ﬁnal invoice is payable on the last day of the term.",
  "The Fee1 is payable in advance.",
  "2. Records and Audit",
  "The Client may audit the Supplier’s",
  "The Supplier shall keep all",
  "records once a year.",
  "records for three years.",
  "3. Liability",
  "The Supplier’s total liability under this Agreement is capped at the fees paid in the",
  "Page 2 of 6",
  "three months before the claim.",
].join("\n");

// Quotes as a model returns them that the rule accepts in PDF_SHAPED_01.
export const PDF_SHAPED_01_FOUND = {
  "the sentence after a letter-spaced heading":
    'This Agreement is made between Kestrel Analytics Private Limited (the "Supplier") and Marigold Foods LLP (the "Client").',
  "a wrapped sentence, quoted with a space for the line break":
    "The Client shall pay the Supplier Rs. 75,000 per month within 30 days of each invoice, unless the Client disputes the invoice in writing.",
  "a line-end hyphen in a plain word, quoted as stored":
    "The Supplier may termi- nate this Agreement on 15 days' notice.",
  "a line-end hyphen in a compound, quoted as stored":
    "The Supplier shall not engage any sub- contractor without the Client's written consent.",
  "the fi ligature, quoted as two letters": "The final invoice is payable on the last day of the term.",
  "the footnote marker kept as a digit": "The Fee1 is payable in advance.",
  "a heading and the sentence under it": "1. Fees The Client shall pay the Supplier Rs. 75,000 per month within 30 days of each invoice, unless the Client disputes the invoice in writing.",
};

// Quotes the rule withholds in PDF_SHAPED_01: what extraction did to the text, and the section 7
// negative cases.
export const PDF_SHAPED_01_WITHHELD = {
  "the letter-spaced heading rejoined": "NOTICE",
  "a line-end hyphen rejoined in a plain word": "The Supplier may terminate this Agreement on 15 days' notice.",
  "a line-end hyphen in a compound kept without the line break":
    "The Supplier shall not engage any sub-contractor without the Client's written consent.",
  "a line-end hyphen in a compound dropped":
    "The Supplier shall not engage any subcontractor without the Client's written consent.",
  "the footnote marker stripped": "The Fee is payable in advance.",
  "a sentence put back together across two columns": "The Client may audit the Supplier's records once a year.",
  "a sentence put back together across a page footer":
    "The Supplier's total liability under this Agreement is capped at the fees paid in the three months before the claim.",
  "the second half of a sentence, after a page footer": "three months before the claim.",
  "the second half of a wrapped sentence":"days of each invoice, unless the Client disputes the invoice in writing.",
  "30 changed to 60":
    "The Client shall pay the Supplier Rs. 75,000 per month within 60 days of each invoice, unless the Client disputes the invoice in writing.",
  '"shall" changed to "may"':
    "The Supplier may not engage any sub- contractor without the Client's written consent.",
  '"not" dropped': "The Supplier shall engage any sub- contractor without the Client's written consent.",
  "a defined term's case changed":
    "The client shall pay the Supplier Rs. 75,000 per month within 30 days of each invoice, unless the Client disputes the invoice in writing.",
  'the trailing "unless" qualifier dropped':
    "The Client shall pay the Supplier Rs. 75,000 per month within 30 days of each invoice.",
  "two clauses spliced with an ellipsis":
    "The Client shall pay the Supplier Rs. 75,000 per month ... without the Client's written consent.",
  "an invented sentence": "The Client may terminate this Agreement at any time without paying a fee.",
};

// Raw text from a DOCX, read the way research 09 says mammoth's raw text works: every paragraph is
// followed by a blank line, auto-numbered clause numbers are absent, a manual line break inside a
// sentence leaves nothing ("thirtydays"), a soft hyphen (U+00AD) and a no-break hyphen (U+2011) are
// kept, curly quotes and an em dash pass through, tracked changes are read as accepted ("30" deleted,
// "60" inserted), and a text box comes out as its own paragraph after the one that holds it.
export const DOCX_SHAPED_01 = [
  "CONSULTING AGREEMENT",
  "This Agreement is between Heron Advisory LLP (the “Consultant”) and Tamarind Retail Private Limited (the “Company”).",
  "The Company shall pay each invoice within thirtydays of receipt.",
  "The Consultant shall keep all Company information confi­dential.",
  "The Consultant shall not accept any non‑compete restriction from a third party.",
  "The Company’s “Confidential Information” excludes public information — including information the Company has published.",
  "Either party may terminate this Agreement on 60 days’ written notice.",
  "The Consultant shall deliver the reports listed in the box below.",
  "Reports are due on the last working day of each quarter.",
  "",
].join("\n\n");

export const DOCX_SHAPED_01_FOUND = {
  "a sentence after an auto-numbered clause, quoted without the number":
    "The Company shall pay each invoice within thirtydays of receipt.",
  "a soft hyphen, quoted without it": "The Consultant shall keep all Company information confidential.",
  "a no-break hyphen, quoted as a plain hyphen":
    "The Consultant shall not accept any non-compete restriction from a third party.",
  "curly quotes and an em dash, quoted straight":
    "The Company's \"Confidential Information\" excludes public information - including information the Company has published.",
  "a tracked change, quoted in its accepted form": "Either party may terminate this Agreement on 60 days' written notice.",
  "a text box, quoted on its own": "Reports are due on the last working day of each quarter.",
};

export const DOCX_SHAPED_01_WITHHELD = {
  "an auto-number the stored text does not hold": "4.2 The Company shall pay each invoice within thirtydays of receipt.",
  "a manual line break read as a space": "The Company shall pay each invoice within thirty days of receipt.",
  "the deleted side of a tracked change": "Either party may terminate this Agreement on 30 days' written notice.",
  "a soft hyphen read as a hyphen": "The Consultant shall keep all Company information confi-dential.",
  '"shall" changed to "may"': "The Consultant may keep all Company information confidential.",
  '"not" dropped': "The Consultant shall accept any non-compete restriction from a third party.",
  "a defined term's case changed":
    "The Company's \"confidential information\" excludes public information - including information the Company has published.",
  "the trailing qualifier dropped": "The Company's \"Confidential Information\" excludes public information.",
  "two clauses spliced with an ellipsis character":
    "Either party may terminate this Agreement… on the last working day of each quarter.",
  "an invented sentence": "The Consultant personally guarantees every report.",
};
