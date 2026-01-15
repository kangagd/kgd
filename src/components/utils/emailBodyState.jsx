/**
 * Helpers to determine if a message has renderable body content.
 * Used to persist preview state across navigation and prevent "No preview available" reappearance.
 */

/**
 * Check if a message has actual body content (HTML or text)
 * @param {Object} message - EmailMessage record
 * @returns {boolean} True if message has non-empty body_html or body_text
 */
export function hasRenderableBody(message) {
  if (!message) return false;
  const html = (message?.body_html || "").trim();
  const text = (message?.body_text || "").trim();
  return html.length > 0 || text.length > 0;
}

/**
 * Select the best message for preview from a list.
 * Prefers newest message with body content, falls back to newest message overall.
 * @param {Array} messages - Array of EmailMessage records
 * @returns {Object|null} Best message to preview, or null if none exist
 */
export function getBestPreviewMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  // Filter messages that have renderable body
  const withBody = messages.filter(hasRenderableBody);

  // If any have body, return the newest one
  if (withBody.length > 0) {
    return withBody.sort((a, b) => {
      const aTime = new Date(a.sent_at || 0).getTime();
      const bTime = new Date(b.sent_at || 0).getTime();
      return bTime - aTime; // Newest first
    })[0];
  }

  // Fallback: return newest message overall (even if no body)
  return messages.sort((a, b) => {
    const aTime = new Date(a.sent_at || 0).getTime();
    const bTime = new Date(b.sent_at || 0).getTime();
    return bTime - aTime;
  })[0];
}