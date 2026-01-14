/**
 * Text Sanitization Utilities
 * Single source of truth for normalizing inbound text
 * (emails, forms, external systems)
 *
 * Responsibilities:
 * - Fix common UTF-8 / Gmail mojibake (â etc.)
 * - Decode basic HTML entities
 * - Remove zero-width / invisible characters
 * - Normalize whitespace
 *
 * IMPORTANT:
 * - Do NOT destructively remove characters (e.g. /â/g)
 * - Preserve legitimate non-English characters
 */

export const sanitizeInboundText = (input) => {
  if (input === null || input === undefined) return input;

  let text = String(input);

  /**
   * Common UTF-8 → Latin1 mojibake sequences seen in Gmail
   * Order matters: more specific sequences first
   */
  const replacements = [
    // Single quotes / apostrophes
    ['â', '’'],
    ['â', '‘'],
    ['â€™', '’'],
    ['â€˜', '‘'],

    // Double quotes
    ['â', '“'],
    ['â', '”'],
    ['â€œ', '“'],
    ['â€�', '”'],

    // Dashes
    ['â', '–'],
    ['â', '—'],
    ['â€"', '—'], // legacy variant

    // Ellipsis / bullets
    ['â¦', '…'],
    ['â€¦', '…'],
    ['â¢', '•'],
    ['â€¢', '•'],

    // Non-breaking space artifacts
    ['Â ', ' '],
    ['&nbsp;', ' '],

    // Misc punctuation
    ['â€º', '›'],
    ['â€¹', '‹'],
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // Replace Unicode non-breaking space with regular space
  text = text.replace(/\u00A0/g, ' ');

  // Remove zero-width / invisible characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Decode basic HTML entities (browser only)
  if (typeof window !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
  }

  // Normalize whitespace
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
};
