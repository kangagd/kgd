/**
 * Email Decoding Guardrails
 * Centralized base64url decoding with padding normalization + error tracking
 */

/**
 * Decode base64url to bytes (with padding normalization)
 * @param {string} b64url - base64url encoded string
 * @returns {Buffer}
 * @throws {Error} if decoding fails
 */
export function decodeBase64UrlToBytes(b64url) {
  if (!b64url || typeof b64url !== 'string') {
    throw new Error('Invalid base64url: must be non-empty string');
  }

  // Normalize: add padding if missing
  let normalized = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  if (remainder > 0) {
    normalized += '='.repeat(4 - remainder);
  }

  try {
    return Buffer.from(normalized, 'base64');
  } catch (err) {
    throw new Error(`Failed to decode base64url: ${err.message}`);
  }
}

/**
 * Validate attachment existence from Gmail MIME parts
 * @param {Array} parts - Gmail message MIME parts
 * @returns {{ expectedCount: number, attachmentIds: string[] }}
 */
export function expectAttachmentsFromParts(parts = []) {
  const attachmentIds = [];
  let expectedCount = 0;

  function walkParts(partsList = []) {
    partsList.forEach(part => {
      // Check for attachment indicator: filename + attachmentId
      if (part.filename && part.attachmentId) {
        attachmentIds.push(part.attachmentId);
        expectedCount++;
      }
      // Recurse into nested parts
      if (part.parts && Array.isArray(part.parts)) {
        walkParts(part.parts);
      }
    });
  }

  walkParts(parts);
  return { expectedCount, attachmentIds };
}

/**
 * Track attachment extraction error
 * @param {string} phase - error phase ('decode', 'extract', 'parse')
 * @param {string} reason - human readable reason
 * @returns {object}
 */
export function createAttachmentExtractionError(phase, reason) {
  return {
    phase,
    reason,
    timestamp: new Date().toISOString(),
  };
}