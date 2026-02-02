/**
 * Normalize UTF-8 text that may have been corrupted by mis-decoding as Latin-1/Windows-1252
 * Safe to call on already-clean text (returns early)
 * Only used at FINAL send boundary before Gmail API
 */
export function normalizeUtf8(text) {
  if (!text) return text;

  // Quick check: only normalize if text has corruption-specific markers
  const looksCorrupt = /â€™|â€œ|â€|â€"|â€"|â€¦|Ã[A-Za-z0-9]{1,2}|Â\s/.test(text);
  if (!looksCorrupt) {
    return text;
  }

  try {
    // Fix common double-encoded UTF-8 sequences
    // This converts text that was incorrectly decoded as Latin-1 back to proper UTF-8
    let normalized = decodeURIComponent(escape(text));
    
    // Additional cleanup: replace problematic characters that survived normalization
    normalized = normalized
      .replace(/â€"/g, '—')  // em dash
      .replace(/â€"/g, '–')  // en dash
      .replace(/â€™/g, "'")  // right single quote
      .replace(/â€˜/g, "'")  // left single quote
      .replace(/â€\u009d/g, '"')  // right double quote
      .replace(/â€\u009c/g, '"')  // left double quote
      .replace(/â€¦/g, '…')  // ellipsis
      .replace(/Â /g, ' ')   // non-breaking space corruption
      .replace(/Â/g, '');    // stray Â
    
    return normalized;
  } catch {
    // If normalization fails, return original text
    return text;
  }
}

/**
 * Check if text contains corruption indicators (for debug logging)
 */
export function hasEncodingCorruption(text) {
  if (!text) return false;
  // â indicates double-encoding issue (UTF-8 decoded as Latin-1)
  return /â|ã|ä|å|ô|õ|ö|÷|ø|ù|ú|û|ü|ý/.test(text);
}