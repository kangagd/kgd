/**
 * Shared type definition and normalizer for Gmail History thread UI state.
 * Ensures consistent shape across all Gmail history search/preview components.
 */

/**
 * @typedef {Object} GmailHistoryThreadUI
 * @property {string} gmailThreadId - Gmail's unique thread ID
 * @property {string} subject - Thread subject line
 * @property {string} snippet - Preview text snippet
 * @property {string|null} lastMessageAt - ISO timestamp of last message
 * @property {string} participantsText - Formatted participant string (e.g., "John <x@x.com> → KGD")
 * @property {number|null} messageCount - Number of messages in thread
 * @property {boolean} hasAttachments - Whether thread has attachments
 * @property {'not_imported'|'imported_unlinked'|'imported_linked'} importedState - Import status
 * @property {'project'|'job'|'none'} linkedEntityType - Type of linked entity
 * @property {string|null} linkedEntityTitle - Title of linked project/job
 */

/**
 * Normalize raw Gmail thread data into consistent UI shape.
 * Safely handles missing fields and accepts multiple field name variants.
 *
 * @param {Object} raw - Raw thread data from API
 * @returns {GmailHistoryThreadUI} Normalized thread shape
 */
export function normalizeGmailHistoryThread(raw) {
  if (!raw) {
    return {
      gmailThreadId: '',
      subject: '',
      snippet: '',
      lastMessageAt: null,
      participantsText: '',
      messageCount: null,
      hasAttachments: false,
      importedState: 'not_imported',
      linkedEntityType: 'none',
      linkedEntityTitle: null
    };
  }

  // Extract ID - accept both gmail_thread_id and gmailThreadId
  const gmailThreadId = raw.gmail_thread_id || raw.gmailThreadId || '';

  // Extract subject - accept both subject and headers.Subject
  const subject = raw.subject || raw.headers?.Subject || '';

  // Extract snippet
  const snippet = raw.snippet || '';

  // Extract last message date
  const lastMessageAt = raw.lastMessageAt || raw.last_message_date || null;

  // Extract message count
  const messageCount = raw.messageCount || raw.message_count || null;

  // Extract attachments flag
  const hasAttachments = Boolean(raw.hasAttachments || raw.has_attachments || false);

  // Build participants text from various possible sources
  let participantsText = '';
  if (raw.participantsText) {
    participantsText = raw.participantsText;
  } else if (raw.participants) {
    const parts = [];
    if (raw.participants.from) parts.push(raw.participants.from);
    if (raw.participants.to?.length > 0) parts.push('→', raw.participants.to.join(', '));
    participantsText = parts.join(' ');
  } else if (raw.from_address || raw.to_addresses) {
    const parts = [];
    if (raw.from_address) parts.push(raw.from_address);
    if (raw.to_addresses?.length > 0) parts.push('→', raw.to_addresses.join(', '));
    participantsText = parts.join(' ');
  }

  // Determine import state and link info
  let importedState = 'not_imported';
  let linkedEntityType = 'none';
  let linkedEntityTitle = null;

  if (raw.imported || raw.imported_state !== 'not_imported') {
    // Check if linked
    if (raw.project_id || raw.job_id) {
      importedState = 'imported_linked';
      linkedEntityType = raw.project_id ? 'project' : 'job';
      linkedEntityTitle = raw.project_title || raw.job_number || raw.linkedEntityTitle || null;
    } else {
      importedState = 'imported_unlinked';
    }
  }

  // Allow explicit override if API provides it
  if (raw.importedState) {
    importedState = raw.importedState;
  }
  if (raw.linkedEntityType) {
    linkedEntityType = raw.linkedEntityType;
  }
  if (raw.linkedEntityTitle !== undefined) {
    linkedEntityTitle = raw.linkedEntityTitle;
  }

  return {
    gmailThreadId,
    subject,
    snippet,
    lastMessageAt,
    participantsText,
    messageCount,
    hasAttachments,
    importedState,
    linkedEntityType,
    linkedEntityTitle
  };
}

/**
 * Normalize an array of raw threads
 * @param {Array} rawThreads - Array of raw thread objects
 * @returns {GmailHistoryThreadUI[]} Array of normalized threads
 */
export function normalizeGmailHistoryThreads(rawThreads) {
  return (rawThreads || []).map(normalizeGmailHistoryThread);
}