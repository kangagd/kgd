/**
 * CRITICAL EMAIL SUBJECT DECODER
 * 
 * GUARDRAIL: This function prevents mojibake in email subjects (â€" → —).
 * DO NOT REMOVE OR MODIFY without understanding the encoding issue.
 * 
 * Problem: Gmail API sometimes returns subjects with MIME encoded-words
 * (e.g., =?UTF-8?B?...?=) that need decoding to prevent display as â€" etc.
 * 
 * Solution: Decode MIME encoded-word format BEFORE storing in database.
 * 
 * @param {string} subjectValue - Raw subject from Gmail API header
 * @returns {string} Properly decoded UTF-8 subject
 */
export function decodeEmailSubject(subjectValue) {
  if (!subjectValue) return '(No Subject)';
  
  try {
    // Check if subject contains MIME encoded-word (=?UTF-8?B?...?= or =?UTF-8?Q?...?=)
    if (subjectValue.includes('=?') && subjectValue.includes('?=')) {
      // Decode MIME encoded-word format
      const decoded = subjectValue.replace(
        /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
        (match, charset, encoding, encodedText) => {
          try {
            if (encoding.toUpperCase() === 'B') {
              // Base64 encoding
              const bytes = Uint8Array.from(atob(encodedText), c => c.charCodeAt(0));
              return new TextDecoder(charset).decode(bytes);
            } else if (encoding.toUpperCase() === 'Q') {
              // Quoted-printable encoding
              const decoded = encodedText
                .replace(/_/g, ' ')
                .replace(/=([0-9A-F]{2})/gi, (_, hex) => 
                  String.fromCharCode(parseInt(hex, 16))
                );
              return decoded;
            }
            return match;
          } catch (err) {
            console.error('Failed to decode MIME word:', err);
            return match;
          }
        }
      );
      return decoded;
    }
    
    // Subject is already plain UTF-8 - return as-is
    return subjectValue;
  } catch (err) {
    console.error('Subject decode error:', err);
    return subjectValue;
  }
}