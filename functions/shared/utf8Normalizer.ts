/**
 * Normalize UTF-8 text that may have been corrupted by mis-decoding as Latin-1/Windows-1252
 * Safe to call on already-clean text (returns early)
 * Only used at FINAL send boundary before Gmail API
 */
export function normalizeUtf8(text) {
  if (!text) return text;

  // Quick check: if text looks clean, return early
  if (!/â|é|ü|ö|ä|ñ|ç|™|–|—|"| |"|'/.test(text)) {
    return text;
  }

  try {
    // Fix common double-encoded UTF-8 sequences
    // This converts text that was incorrectly decoded as Latin-1 back to proper UTF-8
    return decodeURIComponent(escape(text));
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