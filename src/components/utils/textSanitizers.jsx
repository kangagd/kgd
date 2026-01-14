/**
 * Sanitize inbound text from external sources (emails, forms, etc.)
 * - Fixes common UTF-8 mojibake (â etc.)
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
  // Includes the "â¯" narrow NBSP mojibake you showed.
  const replacements = [
    // Apostrophes / quotes
    ["â", "’"],
    ["â", "‘"],
    ["â€™", "’"],
    ["â€˜", "‘"],

    // Double quotes
    ["â", "“"],
    ["â", "”"],
    ["â€œ", "“"],
    ["â€�", "”"],

    // Dashes
    ["â", "–"],
    ["â", "—"],
    ["â€\"", "—"],

    // Ellipsis / bullets
    ["â¦", "…"],
    ["â€¦", "…"],
    ["â¢", "•"],
    ["â€¢", "•"],

    // Angle quotes
    ["â€º", "›"],
    ["â€¹", "‹"],

    // Spaces (mojibake variants)
    ["Â ", " "],      // NBSP rendered as "Â "
    ["Â", ""],        // stray Â
    ["â¯", " "],     // mojibake for narrow no-break space
    ["&nbsp;", " "],  // html entity sometimes appears in text
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // --- Normalize actual Unicode special spaces to regular spaces
  // NBSP (U+00A0), Narrow NBSP (U+202F), Thin space (U+2009)
  text = text
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\u2009/g, " ");

  // --- Remove invisible / joiner characters that break URLs and formatting
  // zero-width space/joiner + BOM + word joiner (U+2060)
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");

  // --- Normalize line endings + tame whitespace (don’t over-normalize)
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
};
