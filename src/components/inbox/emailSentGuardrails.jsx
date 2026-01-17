/**
 * Email Sent Visibility + Auto-Linking Guardrails
 * Ensures sent messages appear immediately
 * Tracks linking lag (> 30s warning)
 */

/**
 * Record sent message + invalidate caches
 * @param {object} options - { baseThreadId, messageId, projectId, queryClient, inboxKeys }
 */
export async function onEmailSent(options = {}) {
  const {
    baseThreadId = null,
    messageId = null,
    projectId = null,
    queryClient = null,
    inboxKeys = null,
  } = options;

  if (!queryClient || !inboxKeys) {
    console.warn('[emailSentGuardrails] Missing queryClient or inboxKeys');
    return;
  }

  // Invalidate thread messages
  if (baseThreadId) {
    await queryClient.invalidateQueries({ queryKey: inboxKeys.messages(baseThreadId) });
    await queryClient.refetchQueries({ queryKey: inboxKeys.messages(baseThreadId) });
  }

  // Invalidate thread list
  await queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });

  // Invalidate drafts
  await queryClient.invalidateQueries({ queryKey: inboxKeys.drafts() });

  // Invalidate project activity if linked
  if (projectId) {
    await queryClient.invalidateQueries({ queryKey: ['projectActivity', projectId] });
    await queryClient.refetchQueries({ queryKey: ['projectActivity', projectId] });
  }

  // Start link lag detector (warn if not linked within 30s)
  if (messageId && projectId) {
    trackLinkingLag(messageId, projectId, 30000); // 30 seconds
  }
}

/**
 * Track if sent message links to project within timeout
 * @param {string} messageId - EmailMessage ID
 * @param {string} projectId - Project ID
 * @param {number} timeoutMs - timeout in milliseconds
 */
async function trackLinkingLag(messageId, projectId, timeoutMs = 30000) {
  const startTime = Date.now();

  const checkInterval = setInterval(async () => {
    try {
      const msg = await base44.entities.EmailMessage.get(messageId);
      
      // Check if linked to project
      if (msg.project_id === projectId) {
        console.log(`[emailSentGuardrails] Message ${messageId} linked to project ${projectId}`);
        clearInterval(checkInterval);
        return;
      }

      // Timeout exceeded
      if (Date.now() - startTime > timeoutMs) {
        console.warn(
          `[emailSentGuardrails] Message ${messageId} not linked to project ${projectId} within ${timeoutMs}ms`
        );
        clearInterval(checkInterval);
      }
    } catch (err) {
      console.error(`[emailSentGuardrails] Linking lag check failed: ${err.message}`);
      clearInterval(checkInterval);
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Ensure sent message includes project context
 * @param {object} sendPayload - payload to gmailSendEmail
 * @param {string} projectId - project ID if sending from project context
 * @returns {object} - updated payload
 */
export function ensureProjectLink(sendPayload = {}, projectId = null) {
  if (projectId) {
    return {
      ...sendPayload,
      project_id: projectId,
    };
  }
  return sendPayload;
}