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
    // Em dash, en dash (CRITICAL - most common issue)
    ['â€"', '—'],    // UTF-8 mojibake for em dash
    ['â€"', '–'],    // UTF-8 mojibake for en dash
    ['–€"', '—'],    // Variant with € character
    ['–€', '—'],     // Short variant with €
    ['â—', '—'],     // simpler em dash variant
    ['â–', '–'],     // simpler en dash variant

    // Apostrophes / quotes
    ['â€™', "'"],    // UTF-8 mojibake for right single quotation mark
    ['â€˜', "'"],    // UTF-8 mojibake for left single quotation mark
    ['â€\u009d', '"'],    // right double quotation mark
    ['â€\u009c', '"'],    // left double quotation mark
    ['â', "'"],      // simpler variants
    ['â', "'"],
    ['â', '"'],
    ['â', '"'],

    // Ellipsis
    ['â€¦', '…'],    // UTF-8 mojibake for horizontal ellipsis
    ['â¦', '…'],     // simpler variant

    // Bullets
    ['â€¢', '•'],    // UTF-8 mojibake for bullet
    ['â¢', '•'],     // simpler variant

    // Angle quotes / guillemets
    ['â€º', '›'],    // right-pointing angle quotation mark
    ['â€¹', '‹'],    // left-pointing angle quotation mark

    // Space variants (NBSP, narrow NBSP mojibake)
    ['Â ', ' '],     // NBSP rendered as "Â "
    ['â¯', ' '],     // mojibake for narrow no-break space
    ['&nbsp;', ' '], // HTML entity appearing in plain text
    ['Â', ''],       // stray Â character

    // Trademark, registered symbols
    ['â„¢', '™'],    // trademark mojibake
    ['Â®', '®'],     // registered mojibake

    // Common accented characters (Latin-1 double-encoding)
    ['Ã©', 'é'],     // e acute
    ['Ã¨', 'è'],     // e grave
    ['Ã', 'à'],      // a grave
    ['Ã§', 'ç'],     // c cedilla
    ['Ã¼', 'ü'],     // u umlaut
    ['Ã¶', 'ö'],     // o umlaut
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // --- Normalize actual Unicode special spaces to regular spaces
  // NBSP (U+00A0), Narrow NBSP (U+202F), Thin space (U+2009), Hair space (U+200A)
  text = text
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2009/g, ' ')
    .replace(/\u200A/g, ' ');

  // --- Remove invisible / joiner characters that break URLs and formatting
  // zero-width space/joiner + BOM + word joiner + soft hyphen
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '');

  // --- Normalize line endings + tame whitespace (don't over-normalize)
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
};