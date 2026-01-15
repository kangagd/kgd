import { decodeEmailText } from './emailFormatting';
import { sanitizeInboundText } from './textSanitizers';

/**
 * Email HTML sanitization utilities
 */

/**
 * Central email HTML sanitization function
 * Removes dangerous content while preserving safe formatting and layout
 * 
 * @param {string} html - Raw HTML to sanitize
 * @param {string} mode - "compose" (strict, extracts body) or "display" (minimal, preserves layout)
 * @param {Array} inlineImages - Optional array of {content_id, url} for replacing cid: references
 * @returns {string} Sanitized HTML
 */
export const sanitizeEmailHtml = (html, mode = "display", inlineImages = []) => {
  if (!html) return html;

  let sanitized = decodeEmailText(html);
  
  // Fix encoding issues
  sanitized = sanitizeInboundText(sanitized);

  // Compose mode: strip document wrappers
  if (mode === "compose") {
    sanitized = sanitized.replace(/<\!DOCTYPE[^>]*>/gi, '');
    sanitized = sanitized.replace(/<html[^>]*>/gi, '');
    sanitized = sanitized.replace(/<\/html>/gi, '');
    sanitized = sanitized.replace(/<head[^>]*>.*?<\/head>/gis, '');
    sanitized = sanitized.replace(/<meta[^>]*>/gi, '');
    
    const bodyMatch = sanitized.match(/<body[^>]*>(.*?)<\/body>/is);
    if (bodyMatch) {
      sanitized = bodyMatch[1];
    }
  }

  // Display/shared: always remove document structures but keep body
  if (mode === "display") {
    sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
    
    const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      sanitized = bodyMatch[1];
    }
  }

  // Replace inline image cid references
  if (inlineImages && inlineImages.length > 0) {
    inlineImages.forEach((img) => {
      if (img.content_id && img.url) {
        const cidPattern = new RegExp(`cid:${img.content_id}`, "gi");
        sanitized = sanitized.replace(cidPattern, img.url);
      }
    });
  }

  // Remove dangerous executable content (shared by all modes)
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed[^>]*>/gi, "");
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  
  // Compose mode: trim result
  if (mode === "compose") {
    return sanitized.trim();
  }

  return sanitized;
};

/**
 * Sanitizes HTML for email composition (removes wrappers, extracts body)
 * Used when quoting/forwarding emails in the composer
 * @deprecated Use sanitizeEmailHtml(html, "compose") instead
 */
export const sanitizeForCompose = (html) => {
  return sanitizeEmailHtml(html, "compose");
};

/**
 * Minimal sanitization for email display (preserves layout/styling)
 * Used when rendering emails in the viewer
 * @deprecated Use sanitizeEmailHtml(html, "display", inlineImages) instead
 */
export const sanitizeForDisplay = (html, inlineImages = []) => {
  return sanitizeEmailHtml(html, "display", inlineImages);
};