import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Paperclip, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import AttachmentCard from "./AttachmentCard";

function AttachmentsSection({ attachments, linkedJobId, linkedProjectId, threadSubject, gmailMessageId }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (attachments.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors w-full"
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        <Paperclip className="w-4 h-4" />
        <span className="font-medium">{attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}</span>
      </button>
      
      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((attachment, idx) => (
            <AttachmentCard
              key={idx}
              attachment={attachment}
              linkedJobId={linkedJobId}
              linkedProjectId={linkedProjectId}
              threadSubject={threadSubject}
              gmailMessageId={attachment.gmail_message_id || gmailMessageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to check if an attachment is referenced as inline in the HTML
function isInlineImageInHtml(attachment, bodyHtml) {
  if (!bodyHtml || !attachment) return false;
  
  // Check if it's marked as inline
  if (attachment.is_inline) return true;
  
  // Check if content_id is referenced in HTML as cid:
  if (attachment.content_id) {
    const cidPattern = new RegExp(`cid:${attachment.content_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    return cidPattern.test(bodyHtml);
  }
  
  return false;
}

export default function EmailMessageView({ message, isFirst, linkedJobId, linkedProjectId, threadSubject, gmailMessageId: propGmailMessageId }) {
  // Use message's own gmail_message_id first, then fall back to prop
  const gmailMessageId = message.gmail_message_id || propGmailMessageId;
  const [expanded, setExpanded] = useState(isFirst);
  const [inlineImageUrls, setInlineImageUrls] = useState({});
  const [loadingInlineImages, setLoadingInlineImages] = useState(false);

  // Separate inline images from regular attachments
  const { inlineAttachments, regularAttachments } = useMemo(() => {
    const attachments = message.attachments || [];
    const inline = [];
    const regular = [];
    
    for (const att of attachments) {
      if (isInlineImageInHtml(att, message.body_html)) {
        inline.push(att);
      } else {
        regular.push(att);
      }
    }
    
    return { inlineAttachments: inline, regularAttachments: regular };
  }, [message.attachments, message.body_html]);

  // Load inline images when expanded
  useEffect(() => {
    if (!expanded || inlineAttachments.length === 0 || loadingInlineImages) return;
    if (Object.keys(inlineImageUrls).length > 0) return; // Already loaded
    
    const loadInlineImages = async () => {
      setLoadingInlineImages(true);
      const urls = {};
      
      for (const att of inlineAttachments) {
        if (att.content_id && att.attachment_id) {
          try {
            const effectiveMsgId = att.gmail_message_id || gmailMessageId;
            if (!effectiveMsgId) {
              console.warn('No gmail_message_id for inline image:', att.filename);
              continue;
            }
            
            const result = await base44.functions.invoke('getGmailAttachment', {
              gmail_message_id: effectiveMsgId,
              attachment_id: att.attachment_id,
              filename: att.filename,
              mime_type: att.mime_type
            });
            
            if (result.data?.url) {
              urls[att.content_id] = result.data.url;
            }
          } catch (err) {
            // Silently fail for inline images - don't break the email view
            console.warn('Failed to load inline image:', att.filename);
          }
        }
      }
      
      setInlineImageUrls(urls);
      setLoadingInlineImages(false);
    };
    
    loadInlineImages();
  }, [expanded, inlineAttachments, gmailMessageId, inlineImageUrls, loadingInlineImages]);

  // Process HTML to replace cid: references with actual URLs
  const processedBodyHtml = useMemo(() => {
    if (!message.body_html) return '';
    
    let html = message.body_html;
    
    // Replace cid: references with resolved URLs
    for (const [contentId, url] of Object.entries(inlineImageUrls)) {
      const cidPattern = new RegExp(`cid:${contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      html = html.replace(cidPattern, url);
    }
    
    return html;
  }, [message.body_html, inlineImageUrls]);

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
              {regularAttachments.length > 0 && (
                <Badge variant="outline" className="text-[11px] h-5 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {regularAttachments.length}
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

            {/* Attachments - Collapsible (only non-inline attachments) */}
            {regularAttachments.length > 0 && (
              <AttachmentsSection 
                attachments={regularAttachments}
                linkedJobId={linkedJobId}
                linkedProjectId={linkedProjectId}
                threadSubject={threadSubject}
                gmailMessageId={gmailMessageId}
              />
            )}
          </div>

          {/* Email Body - Gmail-style rendering with inline images */}
          <div className="mb-5">
            {loadingInlineImages && inlineAttachments.length > 0 && (
              <div className="text-[12px] text-[#6B7280] mb-2 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-[#FAE008] border-t-transparent rounded-full animate-spin" />
                Loading images...
              </div>
            )}
            {processedBodyHtml ? (
              <div 
                className="gmail-email-body"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: '#111827',
                  wordWrap: 'break-word',
                  overflowWrap: 'anywhere'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(processedBodyHtml) }} 
              />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-[1.6] break-words overflow-wrap-anywhere">
                {message.body_text || message.subject || '(No content)'}
              </div>
            )}
          </div>

          </div>
          )}
    </div>
  );
}