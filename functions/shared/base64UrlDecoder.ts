/**
 * Decode Base64URL to Uint8Array with proper padding handling
 * Gmail attachment/content data is Base64URL encoded and often missing '=' padding.
 * This helper safely decodes such strings.
 * 
 * @param {string} base64Url - Base64URL encoded string (may be unpadded)
 * @returns {Uint8Array} Decoded binary data
 * @throws {Error} If decoding fails
 */
export function decodeBase64UrlToBytes(base64Url: string): Uint8Array {
  if (!base64Url) {
    throw new Error('Empty Base64URL string');
  }

  // Step 1: Replace Base64URL characters with standard Base64
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

  // Step 2: Add padding
  const padLength = base64.length % 4;
  if (padLength > 0) {
    base64 += '='.repeat(4 - padLength);
  }

  // Step 3: Decode using native Uint8Array constructor with Buffer (Node-style)
  // This works in Deno which has Node compatibility
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Base64URL decoding failed: ${error.message}`);
  }
}