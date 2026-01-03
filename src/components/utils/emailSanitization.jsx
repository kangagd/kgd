/**
 * Email HTML sanitization utilities
 */

/**
 * Sanitizes HTML for email composition (removes wrappers, extracts body)
 * Used when quoting/forwarding emails in the composer
 */
export const sanitizeForCompose = (html) => {
  if (!html) return html;
  
  let sanitized = html;
  
  // Remove outer HTML document wrappers
  sanitized = sanitized.replace(/<\!DOCTYPE[^>]*>/gi, '');
  sanitized = sanitized.replace(/<html[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/html>/gi, '');
  sanitized = sanitized.replace(/<head[^>]*>.*?<\/head>/gis, '');
  sanitized = sanitized.replace(/<meta[^>]*>/gi, '');
  
  // Extract body content if wrapped in <body> tags
  const bodyMatch = sanitized.match(/<body[^>]*>(.*?)<\/body>/is);
  if (bodyMatch) {
    sanitized = bodyMatch[1];
  }
  
  // Remove dangerous elements
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized.trim();
};

/**
 * Minimal sanitization for email display (preserves layout/styling)
 * Used when rendering emails in the viewer
 */
export const sanitizeForDisplay = (html) => {
  if (!html) return html;
  
  let sanitized = html;
  
  // Only remove dangerous executable content
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers
  
  // Keep inline styles - they're needed for Gmail layout
  // Keep tables and their structure
  // Keep images (including inline/signature images)
  
  return sanitized;
};