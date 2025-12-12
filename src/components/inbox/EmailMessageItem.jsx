import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import AttachmentCard from "./AttachmentCard";

const fixEncodingIssues = (text) => {
  if (!text) return text;
  
  let fixed = text;
  
  // Fix HTML entities first
  fixed = fixed.replace(/&nbsp;/g, ' ');
  fixed = fixed.replace(/&amp;/g, '&');
  fixed = fixed.replace(/&lt;/g, '<');
  fixed = fixed.replace(/&gt;/g, '>');
  fixed = fixed.replace(/&quot;/g, '"');
  fixed = fixed.replace(/&#39;/g, "'");
  fixed = fixed.replace(/&apos;/g, "'");
  fixed = fixed.replace(/&#8217;/g, "'");
  fixed = fixed.replace(/&#8216;/g, "'");
  fixed = fixed.replace(/&#8220;/g, '"');
  fixed = fixed.replace(/&#8221;/g, '"');
  fixed = fixed.replace(/&#8211;/g, '–');
  fixed = fixed.replace(/&#8212;/g, '—');
  
  // Fix double-encoded UTF-8 mojibake patterns
  // These patterns occur when UTF-8 text is incorrectly interpreted as Windows-1252 and then re-encoded as UTF-8
  
  // Pattern "â€™" = right single quote (')
  fixed = fixed.replace(/â€™/g, "'");
  fixed = fixed.replace(/â€˜/g, "'");
  
  // Pattern "â€œ" and "â€" = double quotes
  fixed = fixed.replace(/â€œ/g, '"');
  fixed = fixed.replace(/â€/g, '"');
  
  // Pattern "â€"" = em dash (—)
  fixed = fixed.replace(/â€"/g, '—');
  
  // Pattern "â€"" = en dash (–)
  fixed = fixed.replace(/â€"/g, '–');
  
  // Pattern "â€¦" = ellipsis (…)
  fixed = fixed.replace(/â€¦/g, '…');
  
  // Pattern "â€¢" = bullet (•)
  fixed = fixed.replace(/â€¢/g, '•');
  
  // Common space patterns
  fixed = fixed.replace(/Â /g, ' ');     // non-breaking space
  fixed = fixed.replace(/Â/g, ' ');      // stray Â character
  fixed = fixed.replace(/â€‰/g, ' ');   // thin space
  fixed = fixed.replace(/â €/g, ' ');    // en space
  fixed = fixed.replace(/â ·/g, '·');    // middle dot
  
  // Fix the specific pattern "Weâ€™re" → "We're"
  // Pattern when apostrophe/quote is at end: "â€™" or standalone "â€"
  fixed = fixed.replace(/â€™/g, "'");
  fixed = fixed.replace(/â€˜/g, "'");
  
  // Pattern for numbers with dot: "â ·â" followed by digits
  fixed = fixed.replace(/â ·â(\d+)/g, ' ·$1');
  
  // Other common mojibake patterns
  fixed = fixed.replace(/Ã¢â‚¬â„¢/g, "'");
  fixed = fixed.replace(/Â°/g, '°');
  fixed = fixed.replace(/â‚¬/g, '€');
  
  // Accented characters
  fixed = fixed.replace(/Ã /g, 'à');
  fixed = fixed.replace(/Ã¡/g, 'á');
  fixed = fixed.replace(/Ã¢/g, 'â');
  fixed = fixed.replace(/Ã£/g, 'ã');
  fixed = fixed.replace(/Ã¤/g, 'ä');
  fixed = fixed.replace(/Ã¨/g, 'è');
  fixed = fixed.replace(/Ã©/g, 'é');
  fixed = fixed.replace(/Ãª/g, 'ê');
  fixed = fixed.replace(/Ã«/g, 'ë');
  fixed = fixed.replace(/Ã¬/g, 'ì');
  fixed = fixed.replace(/Ã­/g, 'í');
  fixed = fixed.replace(/Ã®/g, 'î');
  fixed = fixed.replace(/Ã¯/g, 'ï');
  fixed = fixed.replace(/Ã²/g, 'ò');
  fixed = fixed.replace(/Ã³/g, 'ó');
  fixed = fixed.replace(/Ã´/g, 'ô');
  fixed = fixed.replace(/Ãµ/g, 'õ');
  fixed = fixed.replace(/Ã¶/g, 'ö');
  fixed = fixed.replace(/Ã¹/g, 'ù');
  fixed = fixed.replace(/Ãº/g, 'ú');
  fixed = fixed.replace(/Ã»/g, 'û');
  fixed = fixed.replace(/Ã¼/g, 'ü');
  
  return fixed;
};

const convertHtmlToFormattedText = (html) => {
  if (!html) return '';
  
  let text = html;
  
  // Replace common block elements with line breaks
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Fix HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // Clean up excessive whitespace but preserve intentional line breaks
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 line breaks
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
  
  return text.trim();
};

const sanitizeBodyHtml = (html, inlineImages = []) => {
  if (!html) return html;
  
  let sanitized = html;
  
  // Fix encoding issues first
  sanitized = fixEncodingIssues(sanitized);
  
  // Replace inline image references with actual URLs
  if (inlineImages && inlineImages.length > 0) {
    inlineImages.forEach(img => {
      if (img.content_id && img.url) {
        // Match cid: references
        const cidPattern = new RegExp(`cid:${img.content_id}`, 'gi');
        sanitized = sanitized.replace(cidPattern, img.url);
      }
    });
  }
  
  // Remove dangerous tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized;
};

export default function EmailMessageItem({ message, isLast, totalMessages, getSenderInitials }) {
  // Collapse if it's not the last message and there are multiple messages
  const [expanded, setExpanded] = useState(isLast || totalMessages === 1);
  
  // Get inline images with URLs
  const inlineImages = React.useMemo(() => {
    if (!message.attachments) return [];
    return message.attachments
      .filter(att => att.is_inline && att.content_id && att.url)
      .map(att => ({
        content_id: att.content_id,
        url: att.url
      }));
  }, [message.attachments]);

  return (
    <div className="bg-white">
      {/* Message Header */}
      <div 
        className="flex items-start gap-3 p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-full bg-[#FAE008] flex items-center justify-center text-[#111827] font-semibold flex-shrink-0">
          {getSenderInitials(message.from_name, message.from_address)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#111827]">
              {message.from_name || message.from_address}
            </span>
            <span className="text-[13px] text-[#6B7280]">
              {message.sent_at && format(parseISO(message.sent_at), 'MMM d, yyyy, h:mm a')}
            </span>
          </div>
          <div className="text-[13px] text-[#6B7280] truncate">
            to {message.to_addresses?.join(', ')}
          </div>
          {!expanded && (
            <div className="text-[13px] text-[#6B7280] mt-1 truncate">
              {message.body_text ? message.body_text.substring(0, 100) + '...' : '(No preview)'}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-6 pb-6">
          {message.attachments?.length > 0 && (
            <div className="mb-4 pt-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Attachments</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.attachments.map((att, attIdx) => (
                  <AttachmentCard
                    key={`${message.id}-att-${attIdx}`}
                    attachment={att}
                    gmailMessageId={message.gmail_message_id}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="gmail-email-body prose prose-sm max-w-none overflow-hidden">
            {message.body_html && message.body_html.includes('<') ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(message.body_html, inlineImages) }} />
            ) : message.body_html ? (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                {fixEncodingIssues(convertHtmlToFormattedText(message.body_html))}
              </div>
            ) : message.body_text ? (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                {fixEncodingIssues(convertHtmlToFormattedText(message.body_text))}
              </div>
            ) : (
              <div className="text-[14px] text-[#6B7280]">(No content)</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}