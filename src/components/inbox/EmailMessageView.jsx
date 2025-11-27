import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AttachmentCard from "./AttachmentCard";

export default function EmailMessageView({ message, isFirst, linkedJobId, linkedProjectId, threadSubject }) {
  const [expanded, setExpanded] = useState(isFirst);

  // Minimal sanitization - preserve Gmail layout and styling
  const sanitizeBodyHtml = (html) => {
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

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      {/* Message Header */}
      <div
        className="p-4 cursor-pointer hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-[#111827]">
                {message.from_name || message.from_address}
              </span>
              {message.is_outbound && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[11px] h-5">
                  Sent
                </Badge>
              )}
              {message.attachments?.length > 0 && (
                <Badge variant="outline" className="text-[11px] h-5 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {message.attachments.length}
                </Badge>
              )}
              <span className="text-[12px] text-[#9CA3AF] ml-auto">
                {message.sent_at && format(parseISO(message.sent_at), 'MMM d • h:mm a')}
              </span>
            </div>
          </div>
          <button className="text-[#6B7280] hover:text-[#111827] flex-shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Message Body */}
      {expanded && (
        <div className="p-5">
          {/* Email Metadata */}
          <div className="mb-5 pb-4 border-b border-[#F3F4F6] space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">From:</span>
              <div className="flex-1">
                <div className="text-[13px] text-[#111827] font-medium">
                  {message.from_name || message.from_address}
                </div>
                <div className="text-[12px] text-[#6B7280]">{message.from_address}</div>
              </div>
            </div>

            {message.to_addresses?.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">To:</span>
                <div className="flex-1 flex flex-wrap gap-1">
                  {message.to_addresses.map((addr, idx) => (
                    <Badge key={idx} variant="outline" className="text-[12px] font-normal">
                      {addr}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {message.cc_addresses?.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">CC:</span>
                <div className="flex-1 flex flex-wrap gap-1">
                  {message.cc_addresses.map((addr, idx) => (
                    <Badge key={idx} variant="outline" className="text-[12px] font-normal bg-[#F9FAFB]">
                      {addr}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">Date:</span>
              <span className="text-[13px] text-[#111827]">
                {message.sent_at && format(parseISO(message.sent_at), 'EEEE, MMMM d, yyyy • h:mm a')}
              </span>
            </div>

            {message.subject && (
              <div className="flex items-start gap-2">
                <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">Subject:</span>
                <span className="text-[13px] text-[#111827] font-medium">{message.subject}</span>
              </div>
            )}
          </div>

          {/* Email Body - Gmail-style rendering */}
          <div className="mb-5">
            {message.body_html ? (
              <div 
                className="gmail-email-body"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: '#111827',
                  wordWrap: 'break-word',
                  overflowWrap: 'anywhere'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(message.body_html) }} 
              />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-[1.6] break-words overflow-wrap-anywhere">
                {message.body_text || message.subject || '(No content)'}
              </div>
            )}
          </div>

          {/* Attachments with AI Suggestions */}
          {message.attachments?.length > 0 && (
            <div className="border-t border-[#F3F4F6] pt-5">
              <div className="text-[13px] text-[#6B7280] font-semibold mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({message.attachments.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {message.attachments.map((attachment, idx) => (
                  <AttachmentCard
                    key={idx}
                    attachment={attachment}
                    linkedJobId={linkedJobId}
                    linkedProjectId={linkedProjectId}
                    threadSubject={threadSubject}
                    gmailMessageId={attachment.gmail_message_id || message.message_id}
                  />
                ))}
              </div>
            </div>
          )}
          </div>
          )}
    </div>
  );
}