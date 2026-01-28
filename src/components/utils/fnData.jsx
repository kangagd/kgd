/**
 * Universal function response helper
 * Safely extracts data from backend function responses
 * 
 * @param {Object} res - Response from base44.functions.invoke()
 * @returns {Object} Extracted data object (empty object if none found)
 */
export const fnData = (res) => res?.data ?? res ?? {};