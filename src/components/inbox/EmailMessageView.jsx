import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Paperclip, ChevronRight, Reply, Forward, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import AttachmentCard from "./AttachmentCard";
import { processEmailForDisplay } from "@/components/utils/emailFormatting";
import { sanitizeForDisplay } from "@/components/utils/emailSanitization";

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

export default function EmailMessageView({ message, isFirst, linkedJobId, linkedProjectId, threadSubject, gmailMessageId: propGmailMessageId, onReply, onForward, thread }) {
  // Use message's own gmail_message_id first, then fall back to prop
  const gmailMessageId = message.gmail_message_id || propGmailMessageId;
  const [expanded, setExpanded] = useState(isFirst);
  const [inlineImageUrls, setInlineImageUrls] = useState({});
  const [loadingInlineImages, setLoadingInlineImages] = useState(false);
  const [inlineImagesAttempted, setInlineImagesAttempted] = useState(false);
  const [fullContent, setFullContent] = useState(null);
  const [loadingFullContent, setLoadingFullContent] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Fetch full content for historical messages on expand
  useEffect(() => {
    if (expanded && message.isHistorical && !message.body_html && !fullContent && !loadingFullContent) {
      setLoadingFullContent(true);
      base44.functions.invoke('fetchGmailMessage', { gmail_message_id: gmailMessageId })
        .then(res => {
          setFullContent(res.data);
        })
        .catch(err => console.error('Failed to fetch historical content:', err))
        .finally(() => setLoadingFullContent(false));
    }
  }, [expanded, message.isHistorical, message.body_html, gmailMessageId, fullContent, loadingFullContent]);

  // Merge full content if available
  const displayMessage = fullContent ? { ...message, ...fullContent } : message;

  // Separate inline images from regular attachments
  const { inlineAttachments, regularAttachments } = useMemo(() => {
  const attachments = displayMessage.attachments || [];
  const inline = [];
  const regular = [];

  for (const att of attachments) {
    if (isInlineImageInHtml(att, displayMessage.body_html)) {
      inline.push(att);
    } else {
      regular.push(att);
    }
  }

  return { inlineAttachments: inline, regularAttachments: regular };
  }, [displayMessage.attachments, displayMessage.body_html]);

  // Load inline images when expanded
  useEffect(() => {
  if (!expanded || inlineAttachments.length === 0 || loadingInlineImages || inlineImagesAttempted) return;
    
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
      setInlineImagesAttempted(true);
    };
    
    loadInlineImages();
  }, [expanded, inlineAttachments, gmailMessageId, loadingInlineImages, inlineImagesAttempted]);

  // Process HTML to replace cid: references with actual URLs
  const processedBodyHtml = useMemo(() => {
    if (!displayMessage.body_html) return '';
    
    let html = displayMessage.body_html;
    
    // Replace cid: references with resolved URLs
    for (const [contentId, url] of Object.entries(inlineImageUrls)) {
      const cidPattern = new RegExp(`cid:${contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      html = html.replace(cidPattern, url);
    }
    
    return html;
  }, [displayMessage.body_html, inlineImageUrls]);

  // Format email content - preserve original HTML when available
  const formattedEmailContent = useMemo(() => {
    // If we have HTML content, use it directly (already sanitized)
    if (processedBodyHtml) {
      return { html: processedBodyHtml, hasSignature: false, hasQuotes: false };
    }
    
    // For plain text, convert to formatted HTML
    if (displayMessage.body_text) {
      return processEmailForDisplay(displayMessage.body_text, {
        isHtml: false,
        includeSignature: true,
        collapseQuotes: true
      });
    }
    
    return null;
  }, [processedBodyHtml, displayMessage.body_text]);



  return (
    <>
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
              {message.isHistorical && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 text-[11px] h-5">
                  Historical
                </Badge>
              )}
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
            {loadingFullContent && (
              <div className="text-[13px] text-[#6B7280] mb-3 flex items-center gap-2 bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#E5E7EB]">
                <div className="w-4 h-4 border-2 border-[#FAE008] border-t-transparent rounded-full animate-spin" />
                Loading message content...
              </div>
            )}
            {loadingInlineImages && inlineAttachments.length > 0 && (
              <div className="text-[13px] text-[#6B7280] mb-3 flex items-center gap-2 bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#E5E7EB]">
                <div className="w-4 h-4 border-2 border-[#FAE008] border-t-transparent rounded-full animate-spin" />
                Loading images...
              </div>
            )}
            {formattedEmailContent ? (
              <div 
                className="gmail-email-body prose prose-sm max-w-none"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#111827',
                  wordBreak: 'break-word'
                }}
                dangerouslySetInnerHTML={{ __html: formattedEmailContent.html }} 
              />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-[1.6] break-words">
                {displayMessage.body_text || displayMessage.subject || '(No content)'}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {(onReply || onForward) && (
            <div className="flex gap-2 pt-3 border-t border-[#F3F4F6]">
              {onReply && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(message, thread);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </Button>
              )}
              {onForward && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onForward(message, thread);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Forward className="w-4 h-4" />
                  Forward
                </Button>
              )}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModal(true);
                }}
                variant="ghost"
                size="sm"
                className="ml-auto"
                title="Open in modal"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Full Screen Modal */}
    {showModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[16px] font-semibold text-[#111827] truncate">
                  {message.subject || 'Email Message'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowModal(false)}
              className="flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
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

              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#6B7280] font-medium min-w-[60px]">Date:</span>
                <span className="text-[13px] text-[#111827]">
                  {message.sent_at && format(parseISO(message.sent_at), 'EEEE, MMMM d, yyyy • h:mm a')}
                </span>
              </div>
            </div>

            {/* Email Body */}
            <div className="mb-5">
              {formattedEmailContent ? (
                <div 
                  className="gmail-email-body prose prose-sm max-w-none"
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#111827',
                    wordBreak: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{ __html: formattedEmailContent.html }} 
                />
              ) : (
                <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-[1.6] break-words">
                  {displayMessage.body_text || displayMessage.subject || '(No content)'}
                </div>
              )}
            </div>

            {/* Attachments in Modal */}
            {regularAttachments.length > 0 && (
              <div className="pt-4 border-t border-[#F3F4F6]">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[13px] font-medium text-[#6B7280]">
                    {regularAttachments.length} Attachment{regularAttachments.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {regularAttachments.map((attachment, idx) => (
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
              </div>
            )}
          </div>

          {/* Modal Footer with Actions */}
          <div className="flex gap-2 p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
            {onReply && (
              <Button
                onClick={() => {
                  setShowModal(false);
                  onReply(message, thread);
                }}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
            )}
            {onForward && (
              <Button
                onClick={() => {
                  setShowModal(false);
                  onForward(message, thread);
                }}
                variant="outline"
              >
                <Forward className="w-4 h-4 mr-2" />
                Forward
              </Button>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}