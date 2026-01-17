/**
 * Email Project Creation Helper Functions
 * Extracted utilities for parsing email content, extracting data, and classifying projects
 */

/**
 * Extract customer email from EmailMessage
 * Prioritizes: to_addresses (if team), else from_address (external)
 */
export function extractCustomerEmail(emailMessage) {
  if (!emailMessage) return null;

  // Assume from_address is the external customer
  return emailMessage.from_address?.toLowerCase() || null;
}

/**
 * Extract customer name from display name or email
 */
export function extractCustomerName(displayName, email) {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  if (email) {
    const name = email.split('@')[0];
    return name.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return null;
}

/**
 * Extract phone number from email body
 */
export function extractPhoneFromBody(text) {
  if (!text) return null;
  // Simple phone regex: (XXX) XXX-XXXX, XXX-XXX-XXXX, or 10+ digits
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[0] : null;
}

/**
 * Extract address from email body
 * Returns: { street, suburb, postcode, fullAddress }
 */
export function extractAddressFromBody(text) {
  if (!text) return null;

  // Simple Australian address pattern
  // Look for lines with postcode + state abbreviation
  const addressRegex = /(\d+\s+[a-zA-Z\s]+)[,]?\s+([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{4})/;
  const match = text.match(addressRegex);

  if (match) {
    return {
      street: match[1].trim(),
      suburb: match[2].trim(),
      state: match[3],
      postcode: match[4],
      fullAddress: `${match[1].trim()}, ${match[2].trim()} ${match[3]} ${match[4]}`,
    };
  }

  return null;
}

/**
 * Format short address for display
 */
export function formatShortAddress(addressObj) {
  if (!addressObj) return 'Address Unknown';
  if (addressObj.suburb && addressObj.postcode) {
    return `${addressObj.suburb} ${addressObj.postcode}`;
  }
  if (addressObj.suburb) return addressObj.suburb;
  if (addressObj.fullAddress) return addressObj.fullAddress;
  return 'Address Unknown';
}

/**
 * Classify project category from subject + body
 * Returns: { category, confidence }
 */
export function classifyCategory(subject, body, overrideCategory = null) {
  if (overrideCategory) {
    return { category: overrideCategory, confidence: 'user-selected' };
  }

  const combined = `${subject} ${body}`.toLowerCase();

  const categories = {
    'Sectional Door Repair': ['garage door repair', 'broken door', 'door stuck', 'door broken'],
    'Sectional Door Install': ['garage door install', 'new door', 'install garage door'],
    'Roller Shutter Repair': ['roller shutter repair', 'shutter broken', 'shutter stuck'],
    'Roller Shutter Install': ['roller shutter install', 'new shutter', 'install shutter'],
    'Maintenance Service': ['maintenance', 'service call', 'regular service'],
    'General Enquiry': ['enquiry', 'inquiry', 'quote', 'more info'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      return { category, confidence: 'high' };
    }
  }

  // Default
  return { category: 'General Enquiry', confidence: 'low' };
}

/**
 * Clean email body: strip HTML, remove signatures, normalize whitespace
 */
export function cleanEmailBody(htmlBody, textBody) {
  let body = htmlBody || textBody || '';

  // Strip HTML tags
  body = body.replace(/<[^>]*>/g, ' ');

  // Remove signature (often starts with "--" or "Sent from")
  body = body.split(/^--\s*$/m)[0];
  body = body.split(/^Sent from/m)[0];

  // Normalize whitespace
  body = body.replace(/\s+/g, ' ').trim();

  return body;
}

/**
 * Generate bullet-point description from email body
 * Splits sentences and returns array
 */
export function generateBulletDescription(text) {
  if (!text || text.length === 0) return [];

  // Split by period, question mark, or newline
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200) // Reasonable length bullets
    .slice(0, 5); // Max 5 bullets

  return sentences.length > 0 ? sentences : ['Email received from customer'];
}