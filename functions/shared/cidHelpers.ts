/**
 * CID Resolution Helpers - Single source of truth for CID normalization
 */

/**
 * Normalize a Content-ID for consistent matching across sync and resolution
 * @param {string} cid - Content-ID string (may include cid:, <>, whitespace)
 * @returns {string} - normalized ID (lowercase, no brackets, no prefix)
 */
export function normalizeCid(cid = '') {
  return cid
    .toLowerCase()
    .replace(/^cid:/i, '') // Remove cid: prefix
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Check if an image src is a CID reference
 * @param {string} src - image src attribute
 * @returns {boolean}
 */
export function isCidReference(src = '') {
  return /^cid:/i.test(src);
}

/**
 * Extract all CID references from HTML body
 * Returns normalized CID list
 * @param {string} html - email body HTML
 * @returns {Array<string>} - array of normalized CIDs
 */
export function extractCidsFromHtml(html = '') {
  if (!html || typeof html !== 'string') return [];
  
  const cids = [];
  const cidRegex = /src="(cid:[^"]+)"/gi;
  let match;
  
  while ((match = cidRegex.exec(html)) !== null) {
    const src = match[1];
    if (isCidReference(src)) {
      const normalized = normalizeCid(src);
      if (normalized && !cids.includes(normalized)) {
        cids.push(normalized);
      }
    }
  }
  
  return cids;
}

/**
 * Build CID map from attachments
 * Maps normalized CID -> attachment record
 * @param {Array} attachments - EmailMessage attachments
 * @returns {Object} - {normalizedCid: {attachment_id, resolved_at}}
 */
export function buildCidMapFromAttachments(attachments = []) {
  const cidMap = {};
  
  attachments.forEach(att => {
    if (att.content_id_normalized) {
      cidMap[att.content_id_normalized] = {
        attachment_id: att.attachment_id || null,
        resolved_at: att.attachment_id ? new Date().toISOString() : null
      };
    }
  });
  
  return cidMap;
}

/**
 * Determine CID state based on detected CIDs and attachments
 * Does NOT attempt resolution; only marks as unresolved/resolved based on what's available
 * @param {Array<string>} detectedCids - normalized CID list from HTML
 * @param {Object} cidMap - current CID map
 * @returns {string} - "unresolved" | "resolved"
 */
export function determineCidState(detectedCids = [], cidMap = {}) {
  if (detectedCids.length === 0) {
    return 'resolved'; // No CIDs to resolve
  }
  
  // Check if all detected CIDs have attachment_id
  const allResolved = detectedCids.every(
    cid => cidMap[cid]?.attachment_id
  );
  
  return allResolved ? 'resolved' : 'unresolved';
}