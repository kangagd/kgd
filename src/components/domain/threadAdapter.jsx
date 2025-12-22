/**
 * Thread Adapter - Unifies different communication types into a single thread
 * Supported types: emails, internal messages, notes, SMS (future)
 */

/**
 * Thread item structure:
 * {
 *   id: string,
 *   type: 'email' | 'message' | 'note' | 'sms',
 *   timestamp: Date,
 *   author: string,
 *   authorName: string,
 *   body: string,
 *   attachments: Array<{url: string, filename: string}>,
 *   linkedEntity: {type: string, id: string, label: string},
 *   metadata: Object (type-specific data)
 * }
 */

/**
 * Convert email to thread item
 */
export function emailToThreadItem(email, emailThread = null) {
  return {
    id: email.id,
    type: 'email',
    timestamp: new Date(email.sent_at || email.created_date),
    author: email.from_address,
    authorName: email.from_name || email.from_address,
    body: email.body_text || email.body_html || '',
    attachments: (email.attachments || []).map(att => ({
      url: att.url,
      filename: att.filename || 'attachment',
      size: att.size,
      mime_type: att.mime_type
    })),
    linkedEntity: emailThread ? {
      type: 'email_thread',
      id: emailThread.id,
      label: emailThread.subject
    } : null,
    metadata: {
      subject: emailThread?.subject || email.subject,
      to_addresses: email.to_addresses,
      cc_addresses: email.cc_addresses,
      is_outbound: email.is_outbound
    }
  };
}

/**
 * Convert project message to thread item
 */
export function projectMessageToThreadItem(message) {
  return {
    id: message.id,
    type: 'message',
    timestamp: new Date(message.created_date),
    author: message.created_by,
    authorName: message.author_name || message.created_by,
    body: message.message || '',
    attachments: (message.attachments || []).map(url => ({
      url,
      filename: url.split('/').pop()
    })),
    linkedEntity: null,
    metadata: {
      is_internal: message.is_internal
    }
  };
}

/**
 * Convert job message to thread item
 */
export function jobMessageToThreadItem(message) {
  return {
    id: message.id,
    type: 'message',
    timestamp: new Date(message.created_date),
    author: message.created_by,
    authorName: message.author_name || message.created_by,
    body: message.message || '',
    attachments: (message.attachments || []).map(url => ({
      url,
      filename: url.split('/').pop()
    })),
    linkedEntity: null,
    metadata: {
      is_internal: message.is_internal
    }
  };
}

/**
 * Unified thread builder
 * @param {Object} options
 * @param {Array} options.emails - EmailMessage records
 * @param {Array} options.emailThreads - EmailThread records for subject mapping
 * @param {Array} options.projectMessages - ProjectMessage records
 * @param {Array} options.jobMessages - JobMessage records
 * @returns {Array} Sorted unified thread items
 */
export function buildUnifiedThread({
  emails = [],
  emailThreads = [],
  projectMessages = [],
  jobMessages = []
}) {
  const thread = [];

  // Map email threads by ID for quick lookup
  const threadMap = emailThreads.reduce((acc, t) => {
    acc[t.id] = t;
    return acc;
  }, {});

  // Add emails
  emails.forEach(email => {
    const emailThread = threadMap[email.thread_id];
    thread.push(emailToThreadItem(email, emailThread));
  });

  // Add project messages
  projectMessages.forEach(msg => {
    thread.push(projectMessageToThreadItem(msg));
  });

  // Add job messages
  jobMessages.forEach(msg => {
    thread.push(jobMessageToThreadItem(msg));
  });

  // Sort by timestamp (newest first)
  thread.sort((a, b) => b.timestamp - a.timestamp);

  return thread;
}