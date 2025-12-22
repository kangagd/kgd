import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import AttachmentCard from "./AttachmentCard";
import { sanitizeInboundText } from "@/components/utils/textSanitizers";

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
  sanitized = sanitizeInboundText(sanitized);
  
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
                {sanitizeInboundText(convertHtmlToFormattedText(message.body_html))}
              </div>
            ) : message.body_text ? (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                {sanitizeInboundText(convertHtmlToFormattedText(message.body_text))}
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