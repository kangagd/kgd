import { toast } from "sonner";

/**
 * Centralized email sync toast helper
 * Shows exactly one toast based on sync results
 * 
 * @param {Object} result - Response from gmailSyncThreadMessages or similar
 *   Expected shape: { okCount, partialCount, failedCount } or response.data
 */
export function showSyncToast(result) {
  if (!result) return;

  // Normalize counts from response
  const okCount = result?.okCount ?? 0;
  const partialCount = result?.partialCount ?? 0;
  const failedCount = result?.failedCount ?? 0;

  // Show exactly one toast based on priority
  if (okCount > 0 && failedCount === 0) {
    toast.success("Messages synced");
  } else if (okCount === 0 && partialCount > 0) {
    toast.warning("Messages updated, but content is still unavailable. Try again.");
  } else if (failedCount > 0) {
    toast.error("Some messages failed to sync");
  }
}