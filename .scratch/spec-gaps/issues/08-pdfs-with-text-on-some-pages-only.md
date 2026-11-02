# How a PDF with text on some pages only is handled

Type: grilling
Status: resolved
Blocked by: 06

## Question

OQ18. Reject the whole file, or accept it with the image-only pages named and a Clean result blocked? Accepting leaves terms unread. Gates implementation ticket 19.

## Answer

Product owner, 2026-10-31 (asked in session). Reverses the OCR exclusion (ADR 0008). Every PDF is accepted: pages with a real text layer use their embedded text; image-only pages, and scans carrying a hidden OCR text layer, are re-read by Redline's own OCR running in the browser. OCR text is treated uniformly, with no special marking in the UI, and the Source sentence check runs against it like any other stored text. Owner accepted the trade-off that a misread on an OCR page will pass the check. Reason given: 'I believe OCR will be necessary in the markets we operate' (India, English contracts). The OCR engine is ticket 24. Closes OQ18.
