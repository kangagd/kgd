/**
 * Email Merge Field Renderer
 * Single source-of-truth for rendering merge tokens in subject + body
 * Used by Inbox + Project composers at send-time
 */

/**
 * Render merge fields in text
 * @param {string} text - subject or body text
 * @param {object} context - merge context (customer, project, user, etc)
 * @returns {string} - rendered text with tokens replaced (unresolved tokens left as-is)
 */
export function renderMergeFields(text, context = {}) {
  if (!text || typeof text !== 'string') return '';
  if (!context || typeof context !== 'object') return text;

  // Pattern: {field_name}
  const tokenPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  return text.replace(tokenPattern, (match, fieldName) => {
    // Look up value in context (nested path support: customer.name)
    const value = getNestedValue(context, fieldName);
    
    // If found and non-empty, replace; else leave token unchanged
    return value !== undefined && value !== null && value !== '' 
      ? String(value) 
      : match;
  });
}

/**
 * Get nested value from context object
 * @param {object} obj - context object
 * @param {string} path - dot-notation path (e.g. 'customer.name')
 * @returns {any} - value or undefined
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }

  return current;
}

/**
 * Find all unresolved tokens (remaining {field} patterns)
 * @param {string} text - text to scan
 * @returns {string[]} - array of token names (deduped)
 */
export function findUnresolvedTokens(text) {
  if (!text || typeof text !== 'string') return [];

  const tokenPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const tokens = [];
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    tokens.push(match[1]);
  }

  return [...new Set(tokens)]; // Dedupe
}

/**
 * Build standard merge context for email
 * @param {object} options - { customer, project, user, job, contract }
 * @returns {object} - context object ready for renderMergeFields
 */
export function buildEmailMergeContext(options = {}) {
  const { customer = null, project = null, user = null, job = null, contract = null } = options;

  return {
    // Customer fields
    customer_name: customer?.name || '',
    customer_email: customer?.email || '',
    customer_phone: customer?.phone || '',
    customer_address: customer?.address_full || '',

    // Project fields
    project_number: project?.project_number || '',
    project_title: project?.title || '',
    project_status: project?.status || '',

    // Job fields
    job_number: job?.job_number || '',
    job_status: job?.status || '',

    // Contract fields
    contract_name: contract?.name || '',
    contract_status: contract?.status || '',

    // User fields
    user_name: user?.full_name || user?.display_name || '',
    user_email: user?.email || '',

    // Nested objects for advanced usage
    customer,
    project,
    user,
    job,
    contract,
  };
}