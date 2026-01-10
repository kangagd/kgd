import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import AttachmentCard from "./AttachmentCard";
import { sanitizeInboundText } from "@/components/utils/textSanitizers";
import { Badge } from "@/components/ui/badge";

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
  
  // CRITICAL: Remove <style> tags and their content to prevent CSS from showing as text
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove <head> tags and their content
  sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  
  // Extract body content if full HTML document
  const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    sanitized = bodyMatch[1];
  }
  
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
  
  // Remove dangerous tags and attributes
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
  const inlineImages = useMemo(() => {
    if (!message.attachments) return [];
    return message.attachments
      .filter(att => att.is_inline && att.content_id && att.url)
      .map(att => ({
        content_id: att.content_id,
        url: att.url
      }));
  }, [message.attachments]);

  // Separate regular attachments from inline images
  const regularAttachments = useMemo(() => {
    if (!message.attachments) return [];
    return message.attachments.filter(att => !att.is_inline || !att.content_id);
  }, [message.attachments]);

  // Strip HTML for preview text
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className={`bg-white rounded-lg border border-[#E5E7EB] overflow-hidden transition-all ${expanded ? 'shadow-sm' : ''}`}>
      {/* Message Header - Compact when collapsed, full when expanded */}
      <div
        className={`cursor-pointer transition-all ${expanded ? 'p-4 border-b border-[#F3F4F6]' : 'px-4 py-3 hover:bg-[#F9FAFB]'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#FAE008]/20 flex items-center justify-center flex-shrink-0 border border-[#FAE008]/30">
              <span className="text-[13px] font-semibold text-[#111827]">
                {getSenderInitials(message.from_name, message.from_address)}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-[#111827]">
                  {message.from_name || message.from_address}
                </span>
                {message.is_outbound && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5">
                    You
                  </Badge>
                )}
              </div>
              
              {!expanded && (
                <div className="text-[12px] text-[#9CA3AF] truncate mt-0.5">
                  {stripHtml(message.body_html || message.body_text || '').substring(0, 100)}...
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            {regularAttachments.length > 0 && !expanded && (
              <Badge variant="outline" className="text-[11px] h-5">
                📎 {regularAttachments.length}
              </Badge>
            )}
            <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
              {message.sent_at && format(parseISO(message.sent_at), expanded ? 'MMM d, h:mm a' : 'MMM d')}
            </span>
            <button className="text-[#9CA3AF] hover:text-[#111827] flex-shrink-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pt-3 pb-5">
          {/* Compact Metadata - Gmail style */}
          <div className="mb-4 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[#111827]">
                  <span className="font-semibold">{message.from_name || message.from_address}</span>
                  {message.from_name && (
                    <span className="text-[#6B7280] ml-1">&lt;{message.from_address}&gt;</span>
                  )}
                </div>
                <div className="text-[12px] text-[#6B7280] mt-0.5">
                  to {message.to_addresses?.join(', ') || 'me'}
                  {message.cc_addresses?.length > 0 && (
                    <span className="ml-1">• cc: {message.cc_addresses.join(', ')}</span>
                  )}
                </div>
              </div>
              <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
                {message.sent_at && format(parseISO(message.sent_at), 'MMM d, yyyy, h:mm a')}
              </span>
            </div>
          </div>

          {/* Attachments - Above content like Gmail */}
          {regularAttachments.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {regularAttachments.map((att, attIdx) => (
                  <AttachmentCard
                    key={`${message.id}-att-${attIdx}`}
                    attachment={att}
                    gmailMessageId={message.gmail_message_id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Email Body - Gmail-style rendering */}
          <div className="mb-4">
            <div 
              className="gmail-email-body"
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#111827',
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {message.body_html && message.body_html.includes('<') ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(message.body_html, inlineImages) }} />
              ) : message.body_text ? (
                <div className="whitespace-pre-wrap">
                  {sanitizeInboundText(message.body_text)}
                </div>
              ) : (
                <div className="text-[#6B7280]">(No content)</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}