/**
 * Normalize Content-ID for matching (strip cid:, <>, whitespace)
 */
function normalizeCid(cid) {
  if (!cid) return '';
  return cid.replace(/^cid:/i, '').replace(/^<|>$/g, '').trim();
}

/**
 * Resolve cid: image references in email HTML using attachment metadata
 * 
 * @param {string} html - Email body HTML
 * @param {Array} attachments - Email attachments array (may include inline images)
 * @param {Object} options - Options
 *   - onMissingUrl: callback for when an inline attachment lacks a file_url
 *   - onUnmatchedCid: callback when CID in HTML has no matching attachment
 * 
 * @returns {string} HTML with cid: references replaced where URLs exist
 */
export function resolveInlineCidImages(html, attachments = [], options = {}) {
  if (!html || !attachments.length) return html;

  const { onMissingUrl, onUnmatchedCid } = options;

  // Build map of normalized cid -> attachment for inline images
  const cidMap = {};
  const missingCids = [];
  const unmatchedCids = new Set();

  // Index attachments by normalized content_id
  attachments.forEach((att) => {
    if (att.is_inline && att.content_id) {
      // Use content_id_normalized if available, otherwise normalize on-the-fly
      const normalizedCid = att.content_id_normalized || normalizeCid(att.content_id);
      if (normalizedCid) {
        cidMap[normalizedCid] = att;
      }
    }
  });

  // Replace cid: references with resolved URLs
  let resolved = html;

  // Match src="cid:..." or src='cid:...'
  const cidRegex = /src=["']cid:([^"']+)["']/g;
  resolved = resolved.replace(cidRegex, (match, cid) => {
    const normalizedCid = normalizeCid(cid);
    const attachment = cidMap[normalizedCid];

    if (attachment && attachment.file_url) {
      // Found matching attachment with URL - resolve it
      return `src="${attachment.file_url}"`;
    } else if (attachment && !attachment.file_url) {
      // Found matching attachment but no URL yet - mark for lazy-loading
      missingCids.push({
        content_id: normalizedCid,
        attachment_id: attachment.attachment_id,
        gmail_message_id: attachment.gmail_message_id,
      });
      return `src="" data-cid-pending="${normalizedCid}" data-attachment-pending="true"`;
    } else {
      // No matching attachment - mark as unmatched, hide gracefully
      unmatchedCids.add(normalizedCid);
      return `src="" data-cid-unmatched="${normalizedCid}" style="display:none;"`;
    }
  });

  // Callback for missing URLs (caller can lazy-load them)
  if (onMissingUrl && missingCids.length > 0) {
    missingCids.forEach((cidInfo) => {
      onMissingUrl(cidInfo);
    });
  }

  // Callback for unmatched CIDs (for logging/debugging)
  if (onUnmatchedCid && unmatchedCids.size > 0) {
    unmatchedCids.forEach((cid) => {
      onUnmatchedCid(cid);
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