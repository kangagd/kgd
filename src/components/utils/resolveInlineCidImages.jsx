/**
 * Resolve cid: image references in email HTML using attachment metadata
 * 
 * @param {string} html - Email body HTML
 * @param {Array} attachments - Email attachments array (may include inline images)
 * @param {Object} options - Options
 *   - onMissingUrl: callback for when an inline attachment lacks a file_url
 * 
 * @returns {string} HTML with cid: references replaced where URLs exist
 */
export function resolveInlineCidImages(html, attachments = [], options = {}) {
  if (!html || !attachments.length) return html;

  const { onMissingUrl } = options;

  // Build map of content_id -> file_url for inline attachments
  const cidMap = {};
  const missingCids = [];

  attachments.forEach((att) => {
    if (att.is_inline && att.content_id) {
      // Normalize content_id (strip angle brackets)
      let normalizedCid = att.content_id.replace(/^<|>$/g, '');

      if (att.file_url) {
        cidMap[normalizedCid] = att.file_url;
      } else {
        // Track missing URLs for lazy-loading
        missingCids.push({
          content_id: normalizedCid,
          attachment_id: att.attachment_id,
          gmail_message_id: att.gmail_message_id,
        });
      }
    }
  });

  // Replace cid: references with resolved URLs
  let resolved = html;

  // Match src="cid:..." or src='cid:...'
  const cidRegex = /src=["']cid:([^"']+)["']/g;
  resolved = resolved.replace(cidRegex, (match, cid) => {
    const url = cidMap[cid];
    if (url) {
      return `src="${url}"`;
    }
    // Mark for later lazy-loading
    return `src="" data-inline-cid="${cid}" data-attachment-pending="true"`;
  });

  // Callback for missing URLs (caller can lazy-load them)
  if (onMissingUrl && missingCids.length > 0) {
    missingCids.forEach((cidInfo) => {
      onMissingUrl(cidInfo);
    });
  }

  return resolved;
}

/**
 * Hide broken inline images gracefully
 * Call this in a useEffect to find unresolved inline images and hide them
 */
export function hideUnresolvedInlineImages() {
  if (typeof document === 'undefined') return;

  // Find all img tags marked as pending
  const pendingImages = document.querySelectorAll('img[data-attachment-pending="true"]');

  pendingImages.forEach((img) => {
    const handleError = () => {
      img.style.display = 'none';
    };

    // If image already failed to load, hide it
    if (img.naturalWidth === 0) {
      img.style.display = 'none';
    } else {
      // Listen for load errors
      img.addEventListener('error', handleError, { once: true });
    }
  });
}