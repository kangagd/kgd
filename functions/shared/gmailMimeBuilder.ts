/**
 * Gmail MIME Builder - RFC 5322 compliant email message builder
 * Supports multipart/alternative with text/plain and text/html
 * Proper UTF-8 handling with quoted-printable encoding
 */

/**
 * Generate a unique Message-ID
 */
function generateMessageId() {
  const uuid = crypto.randomUUID();
  return `<${uuid}@kangaroogd.local>`;
}

/**
 * Generate a random boundary string for multipart MIME
 */
function generateBoundary() {
  return `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Encode subject line with RFC 2047 if it contains non-ASCII characters
 */
function encodeSubject(subject) {
  if (!subject) return '';
  
  // Check if subject contains non-ASCII characters
  if (/[^\x00-\x7F]/.test(subject)) {
    const utf8Bytes = new TextEncoder().encode(subject);
    const base64 = btoa(String.fromCharCode(...utf8Bytes));
    return `=?UTF-8?B?${base64}?=`;
  }
  
  return subject;
}

/**
 * Convert HTML to plain text
 * Handles basic HTML to text conversion for fallback
 */
function htmlToPlainText(html) {
  if (!html) return '';
  
  let text = html;
  
  // Replace <br>, <p>, <div> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<div[^>]*>/gi, '');
  
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  
  // Clean up multiple newlines
  text = text.replace(/\n\n\n+/g, '\n\n');
  text = text.trim();
  
  return text;
}

/**
 * Encode string as quoted-printable
 * Ensures lines are <= 76 characters with soft line breaks
 */
function toQuotedPrintable(text) {
  if (!text) return '';
  
  let result = '';
  let lineLength = 0;
  const maxLineLength = 76;
  
  const utf8Bytes = new TextEncoder().encode(text);
  
  for (let i = 0; i < utf8Bytes.length; i++) {
    const byte = utf8Bytes[i];
    
    // Characters that need encoding or are special
    if (
      byte < 32 || // Control characters
      byte === 61 || // = sign
      byte > 126 || // Non-ASCII
      (byte === 46 && lineLength === 0) // Period at start of line
    ) {
      const hex = byte.toString(16).toUpperCase().padStart(2, '0');
      const encoded = `=${hex}`;
      
      // Check if we need a soft line break
      if (lineLength + encoded.length > maxLineLength) {
        result += '=\r\n';
        lineLength = 0;
      }
      
      result += encoded;
      lineLength += encoded.length;
    } else if (byte === 10) {
      // LF - convert to CRLF
      result += '\r\n';
      lineLength = 0;
    } else if (byte === 13) {
      // CR - skip, we'll add CRLF on LF
      continue;
    } else {
      // Regular ASCII character
      const char = String.fromCharCode(byte);
      
      // Check if we need a soft line break
      if (lineLength >= maxLineLength - 1) {
        result += '=\r\n';
        lineLength = 0;
      }
      
      result += char;
      lineLength++;
    }
  }
  
  return result;
}

/**
 * Encode string to base64url format for Gmail API
 */
function toBase64Url(str) {
  // Convert string to UTF-8 bytes
  const utf8Bytes = new TextEncoder().encode(str);
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...utf8Bytes));
  
  // Convert to base64url: replace + with -, / with _, remove padding =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build Gmail-ready MIME message
 * 
 * @param {Object} options - Message options
 * @param {string} options.fromEmail - Sender email address
 * @param {string[]} options.to - Recipient email addresses
 * @param {string[]} [options.cc] - CC email addresses
 * @param {string[]} [options.bcc] - BCC email addresses
 * @param {string} options.subject - Email subject
 * @param {string} [options.textBody] - Plain text body (auto-generated from HTML if not provided)
 * @param {string} options.htmlBody - HTML body
 * @param {string} [options.inReplyTo] - Message-ID of email being replied to
 * @param {string[]} [options.references] - Array of Message-IDs in the thread
 * @returns {Object} { raw: string } - Base64url encoded MIME message
 */
export function buildGmailRawMime(options) {
  const {
    fromEmail,
    to = [],
    cc = [],
    bcc = [],
    subject = '',
    textBody,
    htmlBody = '',
    inReplyTo,
    references = []
  } = options;
  
  // Validate required fields
  if (!fromEmail) throw new Error('fromEmail is required');
  if (!to || to.length === 0) throw new Error('to recipients are required');
  if (!htmlBody && !textBody) throw new Error('Either htmlBody or textBody is required');
  
  // Generate plain text from HTML if not provided
  const plainText = textBody || htmlToPlainText(htmlBody);
  
  // Generate Message-ID and boundary
  const messageId = generateMessageId();
  const boundary = generateBoundary();
  
  // Build headers (each line must end with CRLF)
  const headers = [];
  headers.push(`From: ${fromEmail}`);
  headers.push(`To: ${to.join(', ')}`);
  if (cc.length > 0) headers.push(`Cc: ${cc.join(', ')}`);
  if (bcc.length > 0) headers.push(`Bcc: ${bcc.join(', ')}`);
  headers.push(`Subject: ${encodeSubject(subject)}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`Message-ID: ${messageId}`);
  headers.push('MIME-Version: 1.0');
  
  // Add reply headers if this is a reply
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references && references.length > 0) {
    // Ensure references are properly formatted with <>
    const formattedRefs = references.map(ref => 
      ref.startsWith('<') ? ref : `<${ref}>`
    ).join(' ');
    headers.push(`References: ${formattedRefs}`);
  }
  
  // Content-Type header for multipart/alternative
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  
  // Build the MIME body
  const parts = [];
  
  // Part 1: text/plain
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/plain; charset="UTF-8"');
  parts.push('Content-Transfer-Encoding: quoted-printable');
  parts.push('');
  parts.push(toQuotedPrintable(plainText));
  parts.push('');
  
  // Part 2: text/html
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/html; charset="UTF-8"');
  parts.push('Content-Transfer-Encoding: quoted-printable');
  parts.push('');
  parts.push(toQuotedPrintable(htmlBody));
  parts.push('');
  
  // End boundary
  parts.push(`--${boundary}--`);
  
  // Combine headers and body with CRLF line endings
  const rawMessage = [
    ...headers,
    '', // Empty line between headers and body
    ...parts
  ].join('\r\n');
  
  // Encode to base64url for Gmail API
  const raw = toBase64Url(rawMessage);
  
  return { raw };
}

/**
 * Build a Gmail reply MIME message
 * Convenience wrapper for buildGmailRawMime with reply-specific handling
 */
export function buildGmailReplyMime(options) {
  const {
    fromEmail,
    to,
    cc,
    bcc,
    subject,
    textBody,
    htmlBody,
    originalMessageId,
    threadReferences = []
  } = options;
  
  // Build references array: all previous + original
  const references = [...threadReferences];
  if (originalMessageId && !references.includes(originalMessageId)) {
    references.push(originalMessageId);
  }
  
  return buildGmailRawMime({
    fromEmail,
    to,
    cc,
    bcc,
    subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
    textBody,
    htmlBody,
    inReplyTo: originalMessageId,
    references
  });
}