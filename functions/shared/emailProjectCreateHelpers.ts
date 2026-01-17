/**
 * Helpers for createProjectFromEmail
 * - Customer extraction
 * - Category classification
 * - Address extraction
 * - Email body cleaning
 */

/**
 * Extract external customer email from message
 * Prefers from_address if inbound, else to/cc if outbound
 * Filters out internal org emails
 */
export function extractCustomerEmail(message, internalDomains = ['kangaroogd.com.au']) {
  const isInternalDomain = (email) => {
    if (!email) return false;
    const domain = email.toLowerCase().split('@')[1];
    return internalDomains.some(d => domain === d.toLowerCase());
  };

  // Prefer from if inbound
  if (!message.is_outbound && message.from_address && !isInternalDomain(message.from_address)) {
    return message.from_address;
  }

  // Check to addresses if outbound or from is internal
  if (message.to_addresses) {
    const external = message.to_addresses.find(addr => !isInternalDomain(addr));
    if (external) return external;
  }

  // Check cc addresses
  if (message.cc_addresses) {
    const external = message.cc_addresses.find(addr => !isInternalDomain(addr));
    if (external) return external;
  }

  return null;
}

/**
 * Extract customer name from email display name
 * Strips company suffixes, ignores generic names
 */
export function extractCustomerName(fromName = '', fromEmail = '') {
  if (!fromName && !fromEmail) return '';

  // Start with display name
  let name = fromName.trim();

  // Fall back to email local part if no display name
  if (!name && fromEmail) {
    name = fromEmail.split('@')[0].replace(/[._-]/g, ' ').trim();
  }

  // Strip company suffixes
  name = name
    .replace(/\s*(?:Co\.?|Ltd\.?|Inc\.?|LLC|Pty|Limited|Corporation|Corp|Company)$/i, '')
    .replace(/\s*(?:Support|Sales|Team|Admin|Noreply|No-reply|Help|Contact|Support Team)$/i, '')
    .trim();

  // Ensure capitalization
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract phone from email body/signature
 * Looks for AU format or E.164
 */
export function extractPhoneFromBody(bodyText = '') {
  if (!bodyText) return null;

  // AU patterns: 02 1234 5678, (02) 1234 5678, +61 2 1234 5678, 0412 345 678
  const patterns = [
    /(?:\+61|0)(?:2|3|7|8)\s?(?:\d{4}\s?\d{4}|\d{3}\s?\d{3}\s?\d{3})/,
    /(?:\+61|0)4\d{2}\s?\d{3}\s?\d{3}/,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) return match[0];
  }

  return null;
}

/**
 * Extract address from cleaned email body
 * Returns: { street, suburb, postcode, fullAddress }
 */
export function extractAddressFromBody(bodyText = '') {
  if (!bodyText) return null;

  // AU address pattern: number street suburb postcode
  const patterns = [
    /(\d+)\s+([A-Za-z\s]+(?:St|Street|Road|Rd|Ave|Avenue|Lane|Ln|Drive|Dr|Court|Ct|Close|Cl|Crescent|Cres|Boulevard|Blvd|Park|Pde)\.?)\s*,?\s+([A-Za-z\s]+)\s+(\d{4})/i,
    /([A-Za-z\s]+)\s+(\d{4})/i, // Suburb + postcode only
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      if (match.length === 5) {
        return {
          street: `${match[1]} ${match[2]}`.trim(),
          suburb: match[3].trim(),
          postcode: match[4],
          fullAddress: `${match[1]} ${match[2]}, ${match[3]} ${match[4]}`.trim(),
        };
      } else if (match.length === 3) {
        return { suburb: match[1].trim(), postcode: match[2], fullAddress: `${match[1]} ${match[2]}` };
      }
    }
  }

  return null;
}

/**
 * Format short address for project name
 * Returns: "28 Boronia Rd, Randwick" or "Randwick (address pending)" or "Address pending"
 */
export function formatShortAddress(address = null) {
  if (!address) return 'Address pending';

  if (address.street && address.suburb) {
    return `${address.street}, ${address.suburb}`;
  } else if (address.suburb) {
    return `${address.suburb} (address pending)`;
  }

  return 'Address pending';
}

/**
 * Classify category from email subject + body
 * Returns: { category, doorType, confidence }
 */
export function classifyCategory(subject = '', bodyText = '', overrideCategory = null) {
  if (overrideCategory) {
    return { category: overrideCategory, confidence: 'user_selected' };
  }

  const combined = `${subject} ${bodyText}`.toLowerCase();

  // Door types
  const doorTypes = {
    'sectional': ['sectional', 'section door'],
    'roller shutter': ['roller shutter', 'roller door', 'shutter'],
    'tilt': ['tilt door', 'tilt', 'tilting'],
    'sliding': ['sliding door', 'sliding'],
    'swing': ['swing door', 'swing'],
    'garage door': ['garage door', 'garage', 'overhead'],
    'automated gate': ['automated gate', 'gate', 'sliding gate'],
    'custom': ['custom', 'bespoke'],
  };

  let detectedDoorType = 'Garage Door'; // default
  let doorTypeConfidence = 0;

  for (const [type, keywords] of Object.entries(doorTypes)) {
    const matches = keywords.filter(kw => combined.includes(kw)).length;
    if (matches > doorTypeConfidence) {
      detectedDoorType = type.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      doorTypeConfidence = matches;
    }
  }

  // Service types
  const isRepair = /repair|fix|stuck|won't open|fault|broken|malfunction|issue/i.test(combined);
  const isInstall = /install|new door|replace|supply|upgrade|add/i.test(combined);
  const isMaintenance = /maintenance|service|clean|lubricate/i.test(combined);

  let category = 'General Enquiry';
  let categoryConfidence = 'low';

  if (isRepair && doorTypeConfidence > 0) {
    category = `${detectedDoorType} Repair`;
    categoryConfidence = 'high';
  } else if (isInstall && doorTypeConfidence > 0) {
    category = `${detectedDoorType} Install`;
    categoryConfidence = 'high';
  } else if (isMaintenance) {
    category = 'Maintenance Service';
    categoryConfidence = 'medium';
  } else if (doorTypeConfidence > 0) {
    category = `${detectedDoorType} Enquiry`;
    categoryConfidence = 'medium';
  }

  return { category, doorType: detectedDoorType, confidence: categoryConfidence };
}

/**
 * Clean email body: remove quotes, signatures, tracking pixels
 */
export function cleanEmailBody(htmlBody = '', textBody = '') {
  let body = htmlBody || textBody || '';

  // Remove quoted history markers
  body = body.replace(/<div class="gmail_quote"[\s\S]*?<\/div>/gi, '');
  body = body.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');

  // Remove "On <date> ... wrote:" pattern
  body = body.replace(/on\s+.*?wrote:?[\s\n]*/i, '');

  // Remove common signature separators
  body = body.replace(/^--+\s*/gm, '\n');
  body = body.replace(/kind regards[\s\S]*/i, '');
  body = body.replace(/best regards[\s\S]*/i, '');

  // Remove tracking pixels (1x1 images)
  body = body.replace(/<img[^>]*width=['"]?1['"]?[^>]*>/gi, '');

  // Remove remote logos (https:// img that are likely logos)
  // More conservative: keep images that might be relevant

  // Strip HTML tags to text for processing
  const text = body.replace(/<[^>]*>/g, '').trim();

  return text;
}

/**
 * Generate bullet points from email body
 * Max 8 bullets with key facts/requests
 */
export function generateBulletDescription(cleanedText = '') {
  if (!cleanedText) return [];

  // Split into sentences
  const sentences = cleanedText
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Min 10 chars per bullet

  // Extract key patterns
  const bullets = [];
  const seenBullets = new Set();

  for (const sentence of sentences) {
    // Skip generic greetings
    if (/^(hello|hi|dear|thank|regards)/i.test(sentence)) continue;

    // Skip very short or duplicate
    if (sentence.length < 10 || seenBullets.has(sentence)) continue;

    // Truncate to ~100 chars for readability
    const bullet = sentence.substring(0, 120) + (sentence.length > 120 ? '…' : '');
    if (!seenBullets.has(bullet)) {
      bullets.push(bullet);
      seenBullets.add(bullet);
    }

    if (bullets.length >= 8) break;
  }

  return bullets.length > 0 ? bullets : ['Email received from customer'];
}