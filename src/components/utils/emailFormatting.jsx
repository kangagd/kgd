/**
 * Email Formatting Utilities
 * Decodes, cleans, and formats email content for display
 */

/**
 * Decode common encoding artifacts (mojibake)
 */
export function decodeEmailText(text) {
  if (!text) return '';
  
  // Common mojibake replacements
  const replacements = {
    'â€™': "'",
    'â€˜': "'",
    'â€œ': '"',
    'â€�': '"',
    'â€"': '–',
    'â€"': '—',
    'â€¦': '…',
    'Â': '',
    'â€¢': '•',
    'â€º': '›',
    'â€¹': '‹',
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ã§': 'ç',
    'Ã ': 'à',
  };

  let decoded = text;
  for (const [bad, good] of Object.entries(replacements)) {
    decoded = decoded.replace(new RegExp(bad, 'g'), good);
  }

  // Remove zero-width and invisible characters
  decoded = decoded.replace(/[\u200B-\u200D\uFEFF]/g, '');

  return decoded;
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
 * Format text with proper line breaks and clickable links
 */
export function formatEmailText(text) {
  if (!text) return '';

  let formatted = text;

  // Convert URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
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
 * Strip HTML tags but preserve structure
 */
export function stripHtmlButKeepStructure(html) {
  if (!html) return '';
  
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  // Replace block elements with line breaks
  const blockElements = tmp.querySelectorAll('div, p, br, li, tr');
  blockElements.forEach(el => {
    if (el.tagName === 'BR') {
      el.replaceWith('\n');
    } else if (el.tagName === 'LI') {
      el.replaceWith('\n• ' + el.textContent);
    } else {
      const text = el.textContent;
      if (text && text.trim()) {
        el.replaceWith('\n' + text);
      }
    }
  });

  return tmp.textContent || tmp.innerText || '';
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