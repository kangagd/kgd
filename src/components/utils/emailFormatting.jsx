/**
 * Email Formatting Utilities
 * Decodes, cleans, and formats email content for display
 */

/**
 * Decode common encoding artifacts (mojibake)
 */
export function decodeEmailText(input) {
  if (!input) return '';

  let text = String(input);

  // Most common Gmail/UTF-8 mojibake sequences - prioritize longer sequences first
  const replacements = [
    // Em/en dashes (most common - matches the screenshot issue)
    ['â€"', '—'], // em dash UTF-8 mojibake (CRITICAL FIX)
    ['â€"', '–'], // en dash UTF-8 mojibake
    ['â', '–'],
    ['â', '—'],

    // Smart quotes / apostrophes (UTF-8 sequences)
    ['â€™', "'"],  // right single quotation mark
    ['â€˜', "'"],  // left single quotation mark
    ['â€œ', '"'],  // left double quotation mark
    ['â€', '"'],   // right double quotation mark
    ['â', "'"],
    ['â', "'"],
    ['â', '"'],
    ['â', '"'],

    // Ellipsis / bullets
    ['â€¦', '…'],
    ['â¦', '…'],
    ['â€¢', '•'],
    ['â¢', '•'],

    // Spacing artifacts
    ['Â ', ' '],  // NBSP shown as "Â "
    ['â¯', ' '],  // narrow NBSP mojibake
    ['&nbsp;', ' '],
    ['Â', ''],

    // Misc
    ['â€º', '›'],
    ['â€¹', '‹'],
    ['â„¢', '™'],
    ['Â®', '®'],

    // Common latin1 double-encoding samples
    ['Ã©', 'é'],
    ['Ã¨', 'è'],
    ['Ã§', 'ç'],
    ['Ã', 'à'],
    ['Ã¼', 'ü'],
    ['Ã¶', 'ö'],
  ];

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good);
  }

  // Normalize Unicode spaces
  text = text
    .replace(/\u00A0/g, ' ')  // NBSP
    .replace(/\u202F/g, ' ')  // Narrow NBSP
    .replace(/\u2009/g, ' ')  // Thin space
    .replace(/\u200A/g, ' '); // Hair space

  // Remove invisible characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '');

  // Decode basic HTML entities (safe)
  // (Browser only; if this runs server-side, skip)
  if (typeof window !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
  }

  return text;
}

/**
 * Detect and extract signature from email content
 */
export function extractSignature(text) {
  if (!text) return { body: '', signature: '' };

  // Common signature patterns
  const signaturePatterns = [
    /^--\s*$/m,
    /^[-_]{2,}\s*$/m,
    /^(Best regards?|Regards?|Thanks?|Cheers|Sincerely|Kind regards?|Warm regards?),?\s*$/mi,
    /^Sent from my (iPhone|iPad|Android|mobile device)/mi,
  ];

  let splitIndex = -1;
  let matchedPattern = null;

  // Find the first signature pattern
  for (const pattern of signaturePatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      if (splitIndex === -1 || match.index < splitIndex) {
        splitIndex = match.index;
        matchedPattern = pattern;
      }
    }
  }

  // If found, split at the signature
  if (splitIndex !== -1) {
    const body = text.substring(0, splitIndex).trim();
    const signature = text.substring(splitIndex).trim();
    return { body, signature };
  }

  return { body: text.trim(), signature: '' };
}

/**
 * Parse and structure quoted reply chains
 */
export function parseQuotedReplies(text) {
  if (!text) return { latestMessage: '', previousReplies: [] };

  const lines = text.split('\n');
  const messages = [];
  let currentMessage = [];
  let quoteLevel = 0;
  let inQuote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Detect quote headers like "On [date], [name] wrote:"
    const quoteHeader = /^On .+?wrote:$/i.test(trimmedLine) || 
                       /^From:.+?Sent:.+?To:/i.test(trimmedLine);

    // Detect quote prefix
    const quoteMatch = line.match(/^(>+)\s*/);
    const currentQuoteLevel = quoteMatch ? quoteMatch[1].length : 0;

    if (quoteHeader || currentQuoteLevel > quoteLevel) {
      // Starting a new quoted section
      if (currentMessage.length > 0) {
        messages.push({
          content: currentMessage.join('\n').trim(),
          isQuoted: inQuote
        });
        currentMessage = [];
      }
      inQuote = true;
      quoteLevel = Math.max(quoteLevel, currentQuoteLevel);
    }

    // Remove quote markers from line
    const cleanLine = line.replace(/^>+\s*/, '');
    currentMessage.push(cleanLine);
  }

  // Add final message
  if (currentMessage.length > 0) {
    messages.push({
      content: currentMessage.join('\n').trim(),
      isQuoted: inQuote
    });
  }

  // First message is latest
  const latestMessage = messages.length > 0 ? messages[0].content : text;
  const previousReplies = messages.slice(1).filter(m => m.content);

  return { latestMessage, previousReplies };
}

/**
 * Convert HTML to plain text while preserving structure (links, lists, etc.)
 * Used for email display to maintain formatting
 */
export function htmlToPlainTextWithFormatting(html) {
  if (!html) return '';

  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  let text = '';
  const walk = (node) => {
    if (node.nodeType === 3) {
      // Text node
      text += node.textContent;
    } else if (node.nodeType === 1) {
      // Element node
      const tag = node.tagName.toLowerCase();

      if (tag === 'br') {
        text += '\n';
      } else if (tag === 'p' || tag === 'div') {
        if (text && !text.endsWith('\n')) text += '\n';
        node.childNodes.forEach(walk);
        if (!text.endsWith('\n')) text += '\n';
      } else if (tag === 'li') {
        text += '• ';
        node.childNodes.forEach(walk);
        text += '\n';
      } else if (tag === 'ul' || tag === 'ol') {
        if (text && !text.endsWith('\n')) text += '\n';
        node.childNodes.forEach(walk);
      } else if (tag === 'a') {
        text += node.textContent;
        const href = node.getAttribute('href');
        if (href && href !== node.textContent) {
          text += ` (${href})`;
        }
      } else if (tag === 'blockquote') {
        text += '\n> ';
        let blockText = '';
        const blockWalk = (n) => {
          if (n.nodeType === 3) {
            blockText += n.textContent;
          } else if (n.nodeType === 1) {
            if (n.tagName.toLowerCase() === 'br') {
              blockText += '\n> ';
            } else {
              n.childNodes.forEach(blockWalk);
            }
          }
        };
        node.childNodes.forEach(blockWalk);
        text += blockText.replace(/\n/g, '\n> ');
        text += '\n';
      } else if (tag === 'table') {
        // Simple table handling
        const rows = node.querySelectorAll('tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, th');
          text += Array.from(cells).map(c => c.textContent.trim()).join(' | ');
          text += '\n';
        });
      } else {
        node.childNodes.forEach(walk);
      }
    }
  };

  walk(tmp);
  return text.trim();
}

/**
 * Format text with proper line breaks and clickable links
 */
export function formatEmailText(text) {
  if (!text) return '';

  let formatted = text;

  // Convert URLs to clickable links (stop at newline, space, or quote)
  const urlRegex = /(https?:\/\/[^\s\n<>"]+)/g;
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

  // Convert email addresses to mailto links
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  formatted = formatted.replace(emailRegex, '<a href="mailto:$1" class="text-blue-600 hover:underline">$1</a>');

  // Convert line breaks to <br> (but not double breaks which become paragraphs)
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');
  formatted = '<p>' + formatted + '</p>';

  return formatted;
}

/**
 * Strip HTML tags but preserve structure (deprecated - use htmlToPlainTextWithFormatting instead)
 */
export function stripHtmlButKeepStructure(html) {
  if (!html) return '';
  
  try {
    return htmlToPlainTextWithFormatting(html);
  } catch (err) {
    // Fallback to simple text extraction
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
}

/**
 * Main function: Process email for display
 * Returns formatted HTML ready for rendering
 */
export function processEmailForDisplay(emailContent, options = {}) {
  const {
    isHtml = false,
    includeSignature = true,
    collapseQuotes = true
  } = options;

  if (!emailContent) return { html: '', hasSignature: false, hasQuotes: false };

  // Step 1: Convert to text if HTML
  let text = isHtml ? stripHtmlButKeepStructure(emailContent) : emailContent;

  // Step 2: Decode encoding artifacts
  text = decodeEmailText(text);

  // Step 3: Extract signature
  const { body, signature } = extractSignature(text);

  // Step 4: Parse quoted replies
  const { latestMessage, previousReplies } = parseQuotedReplies(body);

  // Step 5: Format latest message
  let formattedLatest = formatEmailText(latestMessage);

  // Build final HTML
  let html = `<div class="email-body">${formattedLatest}</div>`;

  // Add previous replies (collapsed by default)
  if (previousReplies.length > 0 && collapseQuotes) {
    const quotedContent = previousReplies.map(r => formatEmailText(r.content)).join('<hr class="my-2 border-gray-200">');
    html += `
      <details class="mt-4 text-sm text-gray-600">
        <summary class="cursor-pointer hover:text-gray-900 font-medium">
          Show previous messages (${previousReplies.length})
        </summary>
        <div class="mt-2 pl-4 border-l-2 border-gray-300">
          ${quotedContent}
        </div>
      </details>
    `;
  }

  // Add signature (muted style)
  if (signature && includeSignature) {
    html += `
      <div class="email-signature mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
        ${formatEmailText(signature)}
      </div>
    `;
  }

  return {
    html,
    hasSignature: !!signature,
    hasQuotes: previousReplies.length > 0,
    latestMessage,
    signature,
    previousReplies
  };
}