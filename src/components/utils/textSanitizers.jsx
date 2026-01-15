/**
 * Sanitize inbound text from external sources (emails, forms, etc.)
 * - Fixes common UTF-8 mojibake (â etc.)
 * - Normalizes special spacing characters (NBSP, narrow NBSP)
 * - Removes zero-width and joiner characters
 * - Light whitespace normalization
 *
 * Safe to run on plain text and HTML strings (but avoid running repeatedly).
 */
export const sanitizeInboundText = (input) => {
  if (input === null || input === undefined) return input;

  let text = String(input);

  // --- Fix common UTF-8 mojibake sequences (Gmail / copy/paste artifacts)
  // These occur when UTF-8 bytes are incorrectly interpreted as Latin-1
  const replacements = [
    // Apostrophes / quotes (single byte and 2-byte UTF-8 sequences)
    ["â€™", "'"],    // UTF-8 mojibake for right single quotation mark
    ["â€˜", "'"],    // UTF-8 mojibake for left single quotation mark
    ["â", "'"],      // simpler variant
    ["â", "'"],      // simpler variant
    ["â", "'"],      // final variant

    // Double quotes (single byte and 2-byte UTF-8 sequences)
    ["â€œ", """],    // UTF-8 mojibake for left double quotation mark
    ["â€", """],     // UTF-8 mojibake for right double quotation mark
    ["â", """],      // simpler variant
    ["â", """],      // simpler variant
    ["â€�", """],    // replacement character variant

    // Em dash, en dash, and minus (most common formatting issue)
    ["â€"", "—"],    // UTF-8 mojibake for em dash (most common)
    ["â€"", "–"],    // UTF-8 mojibake for en dash
    ["â", "–"],      // simpler en dash variant
    ["â", "—"],      // simpler em dash variant
    ["â€"", "—"],    // alternative em dash encoding

    // Ellipsis
    ["â€¦", "…"],    // UTF-8 mojibake for horizontal ellipsis
    ["â¦", "…"],     // simpler variant

    // Bullets
    ["â€¢", "•"],    // UTF-8 mojibake for bullet
    ["â¢", "•"],     // simpler variant

    // Angle quotes / guillemets
    ["â€º", "›"],    // right-pointing angle quotation mark
    ["â€¹", "‹"],    // left-pointing angle quotation mark

    // Space variants (NBSP, narrow NBSP mojibake)
    ["Â ", " "],     // NBSP rendered as "Â " (UTF-8 mojibake)
    ["â¯", " "],     // mojibake for narrow no-break space (U+202F)
    ["&nbsp;", " "], // HTML entity appearing in plain text
    ["Â", ""],       // stray Â character

    // Copyright, registered, trademark symbols
    ["â„¢", "™"],    // trademark mojibake
    ["Â®", "®"],     // registered mojibake

    // Common accented characters (Latin-1 double-encoding)
    ["Ã©", "é"],     // e acute
    ["Ã¨", "è"],     // e grave
    ["Ã", "à"],      // a grave
    ["Ã§", "ç"],     // c cedilla
    ["Ã¼", "ü"],     // u umlaut
    ["Ã¶", "ö"],     // o umlaut
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // --- Normalize actual Unicode special spaces to regular spaces
  // NBSP (U+00A0), Narrow NBSP (U+202F), Thin space (U+2009), Hair space (U+200A)
  text = text
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/\u200A/g, " ");

  // --- Remove invisible / joiner characters that break URLs and formatting
  // zero-width space/joiner + BOM + word joiner (U+2060) + soft hyphen
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, "");

  // --- Normalize line endings + tame whitespace (don't over-normalize)
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
};