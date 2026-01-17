/**
 * Wix Enquiry Classifier + Threading Guardrails
 * Detects Wix form submissions to prevent incorrect merging
 */

const WIX_MARKERS = [
  'wix.com',
  'crm.wix.com',
  'wixforms',
  'wixmail',
];

const WIX_SUBJECT_PATTERNS = [
  /wix\s+form/i,
  /from\s+.*\s+wix/i,
];

/**
 * Classify if email is a Wix enquiry
 * @param {string} fromAddress - sender email
 * @param {object} headers - email headers (optional)
 * @returns {boolean}
 */
export function isWixEnquiry(fromAddress = '', headers = {}) {
  if (!fromAddress) return false;

  const fromLower = fromAddress.toLowerCase();
  
  // Check sender domain
  if (WIX_MARKERS.some(marker => fromLower.includes(marker))) {
    return true;
  }

  // Check headers for Wix markers
  const subject = (headers['subject'] || '').toLowerCase();
  if (WIX_SUBJECT_PATTERNS.some(pattern => pattern.test(subject))) {
    return true;
  }

  const listId = (headers['list-id'] || '').toLowerCase();
  if (WIX_MARKERS.some(marker => listId.includes(marker))) {
    return true;
  }

  return false;
}

/**
 * Determine thread identity based on source
 * @param {object} message - EmailMessage with from_address, gmail_thread_id, headers
 * @param {boolean} enableV2 - use EMAIL_THREADING_V2 logic
 * @returns {{ threadKey: string, sourceType: 'email' | 'wix_enquiry', forceNewThread: boolean }}
 */
export function determineThreadIdentity(message, enableV2 = true) {
  if (!enableV2) {
    // Legacy: allow merge by thread ID
    return {
      threadKey: message.gmail_thread_id || `manual_${message.id}`,
      sourceType: 'email',
      forceNewThread: false,
    };
  }

  // V2: Check if Wix enquiry
  const headers = message.headers || {};
  if (isWixEnquiry(message.from_address, headers)) {
    // Wix: force new thread per enquiry (use message ID as unique key)
    return {
      threadKey: `wix_${message.gmail_message_id}`,
      sourceType: 'wix_enquiry',
      forceNewThread: true,
    };
  }

  // Normal email: use Gmail thread ID
  return {
    threadKey: message.gmail_thread_id || `manual_${message.id}`,
    sourceType: 'email',
    forceNewThread: false,
  };
}