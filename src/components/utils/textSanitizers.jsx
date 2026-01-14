import { sanitizeInboundText } from './textSanitizers';

export function decodeEmailText(text) {
  return sanitizeInboundText(text) || '';
}

let sanitized = sanitizeInboundText(html);

/**
 * Normalize inbound text from external sources (emails, forms, etc.)
 * - Fixes common UTF-8 mojibake (â etc.)
 * - Decodes basic HTML entities
 * - Removes zero-width chars
 * - Normalizes whitespace
 *
 * NOTE: Avoid destructive blanket removals (e.g. removing all 'â')
 */
export const sanitizeInboundText = (input) => {
  if (input === null || input === undefined) return input;

  let text = String(input);

  // Common Gmail/UTF-8 mojibake sequences (most important first)
  const replacements = [
    // Apostrophes / quotes
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
    ['â€"', '—'], // older variant

    // Ellipsis / bullet
    ['â¦', '…'],
    ['â€¦', '…'],
    ['â¢', '•'],
    ['â€¢', '•'],

    // NBSP artifacts
    ['Â ', ' '], // NBSP rendered as "Â "
    ['Â ', ' '],
    ['&nbsp;', ' '],

    // Misc
    ['â€º', '›'],
    ['â€¹', '‹'],
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // Replace Unicode NBSP with regular space
  text = text.replace(/\u00A0/g, ' ');

  // Remove zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Decode HTML entities (browser only)
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
