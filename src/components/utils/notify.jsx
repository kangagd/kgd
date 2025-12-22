import { toast } from "sonner";

/**
 * Display a success notification
 * @param {string} message - Success message to display
 */
export function notifySuccess(message) {
  toast.success(message);
}

/**
 * Display an error notification
 * @param {string} message - Error message to display
 * @param {Error|string} [error] - Optional error object or message
 */
export function notifyError(message, error) {
  const errorMsg = error
    ? `${message}: ${typeof error === 'string' ? error : error.message || 'Unknown error'}`
    : message;
  toast.error(errorMsg);
}