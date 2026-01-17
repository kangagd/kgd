/**
 * Inline CID Image Guardrails
 * - Only process true cid: images
 * - Normalize content IDs end-to-end
 * - Track mapping failures
 * - UI timeout guardrails
 */

/**
 * Normalize a Content-ID for consistent matching
 * @param {string} cid - content-id string (may include cid:, <>, whitespace)
 * @returns {string} - normalized ID
 */
export function normalizeCid(cid = '') {
  return cid
    .replace(/^cid:/i, '') // Remove cid: prefix
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim(); // Trim whitespace
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
 * Resolve CID images in HTML
 * Maps cid: references to attachment URLs
 * @param {string} html - email HTML body
 * @param {Array} attachments - email attachments with content_id_normalized
 * @returns {object} - { resolvedHtml, pendingCids: Array, errors: Array }
 */
export function resolveCidImages(html, attachments = []) {
  if (!html || typeof html !== 'string') {
    return { resolvedHtml: html, pendingCids: [], errors: [] };
  }

  const pendingCids = [];
  const errors = [];

  // Build normalized CID -> attachment URL map
  const cidMap = {};
  attachments.forEach(att => {
    if (att.content_id_normalized && att.url) {
      cidMap[att.content_id_normalized] = att.url;
    }
  });

  // Replace cid: src with URLs or mark as pending
  const resolved = html.replace(
    /src="(cid:[^"]+)"/gi,
    (match, src) => {
      if (!isCidReference(src)) return match; // Not a CID, leave as-is

      const normalized = normalizeCid(src);
      const url = cidMap[normalized];

      if (url) {
        // Mapped: replace with URL
        return `src="${url}"`;
      } else {
        // Unmapped: mark as pending + add placeholder class
        pendingCids.push(normalized);
        errors.push({
          cid: normalized,
          reason: 'CID not found in attachments',
        });
        return `src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50' y='50' text-anchor='middle' dominant-baseline='middle'%3E?%3C/text%3E%3C/svg%3E" class="cid-placeholder"`;
      }
    }
  );

  return {
    resolvedHtml: resolved,
    pendingCids: [...new Set(pendingCids)],
    errors,
  };
}

/**
 * Check if HTML has unresolved inline images
 * @param {string} html - email HTML
 * @returns {boolean}
 */
export function hasPendingInlineImages(html) {
  if (!html) return false;
  return /cid:/i.test(html) || /class="cid-placeholder"/i.test(html);
}