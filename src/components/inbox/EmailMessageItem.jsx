import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import AttachmentCard from "./AttachmentCard";

const sanitizeBodyHtml = (html) => {
  if (!html) return html;
  
  let sanitized = html;
  
  // Fix common encoding issues (mojibake from Windows-1252 → UTF-8)
  sanitized = sanitized.replace(/â€"/g, '—');  // em dash
  sanitized = sanitized.replace(/â€"/g, '–');  // en dash
  sanitized = sanitized.replace(/â€œ/g, '"');  // left double quote
  sanitized = sanitized.replace(/â€/g, '"');   // right double quote
  sanitized = sanitized.replace(/â€™/g, "'");  // right single quote
  sanitized = sanitized.replace(/â€˜/g, "'");  // left single quote
  sanitized = sanitized.replace(/Â /g, ' ');   // non-breaking space
  sanitized = sanitized.replace(/Â/g, ' ');    // stray non-breaking space marker
  sanitized = sanitized.replace(/â€¦/g, '…');  // ellipsis
  sanitized = sanitized.replace(/Ã¢â‚¬â„¢/g, "'");  // another single quote variant
  sanitized = sanitized.replace(/â€¢/g, '•');  // bullet point
  
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
            {message.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(message.body_html) }} />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                {message.body_text || '(No content)'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}