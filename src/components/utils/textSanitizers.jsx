/**
 * Sanitize inbound text from external sources (emails, forms, etc.)
 * Handles encoding issues, special characters, and normalizes whitespace
 */
export const sanitizeInboundText = (text) => {
  if (!text) return text;

  return text
    // Fix UTF-8 encoding issues (mojibake patterns)
    .replace(/Â¢/g, "'")    // Â¢ → apostrophe
    .replace(/Â¯/g, ' ')    // Â¯ → space
    .replace(/Â  /g, ' ')   // Â followed by spaces → single space
    .replace(/Â/g, '')      // Remove remaining  â characters
    // Replace HTML non-breaking space entity
    .replace(/&nbsp;/g, ' ')
    // Replace narrow no-break space (common encoding issue)
    .replace(/â¯/g, ' ')
    // Replace Unicode non-breaking space
    .replace(/\u00A0/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize curly quotes to straight quotes
    .replace(/[\u201C\u201D]/g, '"')  // curly double quotes
    .replace(/[\u2018\u2019]/g, "'")  // curly single quotes
    // Normalize dashes
    .replace(/[\u2013\u2014]/g, '-')  // en-dash and em-dash to hyphen
    // Clean up double spaces from character fixes
    .replace(/  +/g, ' ');
};