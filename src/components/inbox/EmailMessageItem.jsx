import React, { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AttachmentCard from "./AttachmentCard";
import { sanitizeInboundText } from "@/components/utils/textSanitizers";
import { sanitizeEmailHtml } from "@/components/utils/emailSanitization";
import { showSyncToast } from "@/components/utils/emailSyncToast";
import { resolveInlineCidImages, hideUnresolvedInlineImages } from "@/components/utils/resolveInlineCidImages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Extract quoted content from HTML for Gmail-style threads.
 * We keep this lightweight + safe:
 * - If we find blockquotes or common quote containers, we split main vs quoted.
 * - Otherwise main=html, quoted=null.
 */
const splitQuotedHtml = (html) => {
  if (!html) return { mainHtml: "", quotedHtml: "" };

  const lower = html.toLowerCase();

  // Common Gmail quote markers
  const markers = [
    "<blockquote",
    "class=\"gmail_quote\"",
    "class='gmail_quote'",
    "class=\"yahoo_quoted\"",
    "class='yahoo_quoted'",
    "id=\"appendonsend\"",
    "id='appendonsend'",
    "class=\"moz-cite-prefix\"",
    "class='moz-cite-prefix'",
  ];

  // Find earliest marker index
  let idx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }

  if (idx === -1) {
    // Also handle plain-text style: "On ... wrote:"
    const onWroteIdx = lower.indexOf("on ");
    const wroteIdx = lower.indexOf(" wrote:");
    if (onWroteIdx !== -1 && wroteIdx !== -1 && wroteIdx > onWroteIdx) {
      // Heuristic: if "On ... wrote:" appears, treat everything from that line as quoted
      // NOTE: This is best-effort for HTML emails that include it as text.
      const cut = lower.indexOf("on ");
      if (cut !== -1) {
        return {
          mainHtml: html.slice(0, cut),
          quotedHtml: html.slice(cut),
        };
      }
    }

    return { mainHtml: html, quotedHtml: "" };
  }

  return {
    mainHtml: html.slice(0, idx),
    quotedHtml: html.slice(idx),
  };
};



// Safe HTML -> text preview without DOM dependency
const htmlToTextPreview = (html) => {
  if (!html) return "";

  let text = html;

  // Replace common blocks with newlines
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");

  // Remove tags
  text = text.replace(/<[^>]*>/g, "");

  // Entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");

  // Normalize
  text = sanitizeInboundText(text);
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");

  return text.trim();
};

export default function EmailMessageItem({
  message,
  isLast,
  totalMessages,
  getSenderInitials,
  isNew, // optional flag from EmailDetailView divider logic
  threadId,
  onResyncMessage,
}) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  // Collapse if it's not the last message and there are multiple messages
  const [expanded, setExpanded] = useState(isLast || totalMessages === 1);
  const [showQuoted, setShowQuoted] = useState(false);
  const [inlineImageErrors, setInlineImageErrors] = useState(new Set()); // Track failed image CIDs
  const [isRetryingImages, setIsRetryingImages] = useState(false);

  // Check if message has no body (ignore has_body flag; check actual content)
  const hasHtml = !!message?.body_html && message.body_html.trim() !== "";
  const hasText = !!message?.body_text && message.body_text.trim() !== "";
  const hasNoBody = !hasHtml && !hasText;

  const handleReSyncMessage = async () => {
    setIsSyncing(true);
    try {
      // Re-sync just this message thread
      if (message.gmail_thread_id) {
        const response = await base44.functions.invoke('gmailSyncThreadMessages', {
          gmail_thread_id: message.gmail_thread_id,
        });
        
        showSyncToast(response.data);
        
        // Refetch messages for this thread
        await queryClient.invalidateQueries({ 
          queryKey: ["emailMessages", threadId || message.thread_id] 
        });
        onResyncMessage?.();
      }
    } catch (error) {
      console.error('EmailMessageItem handleReSyncMessage error:', { messageId: message?.id, error });
      toast.error('Failed to sync message');
    } finally {
      setIsSyncing(false);
    }
  };

  // Get inline images with URLs (prefer file_url from lazy-load, fallback to url)
  const inlineImages = useMemo(() => {
    if (!message.attachments) return [];
    return message.attachments
      .filter((att) => att.is_inline && att.content_id && (att.file_url || att.url))
      .map((att) => ({
        content_id: att.content_id,
        url: att.file_url || att.url,
      }));
  }, [message.attachments]);

  // Separate regular attachments from inline images (only is_inline flag matters)
  const regularAttachments = useMemo(() => {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    return attachments.filter((att) => !att?.is_inline);
  }, [message.attachments]);

  // Body handling (main vs quoted)
  const { mainHtml, quotedHtml } = useMemo(() => {
    return splitQuotedHtml(message?.body_html || "");
  }, [message.body_html]);

  const hasQuoted = !!quotedHtml && quotedHtml.trim().length > 0;

  // Memoize expensive sanitization operations
  const sanitizedMainHtml = useMemo(() => {
    let html = sanitizeEmailHtml(mainHtml || message.body_html || "", "display");
    // Resolve cid: references to actual inline image URLs
    html = resolveInlineCidImages(html, message.attachments, {
      onMissingUrl: (cidInfo) => {
        // Lazy-load inline image if not yet resolved
        if (cidInfo.gmail_message_id && cidInfo.attachment_id) {
          base44.functions.invoke('gmailGetInlineAttachmentUrl', {
            gmail_message_id: cidInfo.gmail_message_id,
            attachment_id: cidInfo.attachment_id,
          }).then(() => {
            // Refetch message to get updated attachments with file_url
            queryClient.invalidateQueries({ queryKey: ["emailMessages", threadId || message.thread_id] });
          }).catch((err) => {
            console.error('Failed to load inline image:', err);
            // Mark this CID as failed
            setInlineImageErrors((prev) => new Set(prev).add(cidInfo.content_id));
          });
        }
      }
    });
    return html;
  }, [mainHtml, message.body_html, message.attachments, threadId, message.thread_id, queryClient]);

  const sanitizedQuotedHtml = useMemo(() => {
    let html = sanitizeEmailHtml(quotedHtml || "", "display");
    // Resolve cid: references in quoted content too
    html = resolveInlineCidImages(html, message.attachments);
    return html;
  }, [quotedHtml, message.attachments]);

  const previewText = useMemo(() => {
    const base =
     message.body_text?.trim()
       ? message.body_text
       : htmlToTextPreview(message.body_html || "");
    return sanitizeInboundText(base || "");
  }, [message.body_text, message.body_html]);

  // Hide unresolved inline images on render
  useEffect(() => {
    if (expanded) {
      hideUnresolvedInlineImages();
    }
  }, [expanded, sanitizedMainHtml]);

  const directionLabel = message.is_outbound ? "Sent" : "Received";

  // Visual treatment
  const accentClass = message.is_outbound ? "bg-blue-500" : "bg-[#E5E7EB]";
  const containerTint = message.is_outbound ? "bg-blue-50/30" : "bg-white";

  // Retry failed inline images
  const handleRetryImages = async () => {
    setIsRetryingImages(true);
    const failedAttachments = (message.attachments || []).filter(
      (att) => att.is_inline && att.content_id && inlineImageErrors.has(att.content_id) && !att.file_url
    );
    
    try {
      await Promise.all(
        failedAttachments.map((att) =>
          base44.functions.invoke('gmailGetInlineAttachmentUrl', {
            gmail_message_id: message.gmail_message_id,
            attachment_id: att.attachment_id,
          })
        )
      );
      // Refetch to get updated attachments
      await queryClient.invalidateQueries({ queryKey: ["emailMessages", threadId || message.thread_id] });
      setInlineImageErrors(new Set()); // Clear errors on success
      toast.success('Images loaded');
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load images';
      console.error('Retry failed for inline images:', err);
      toast.error(errorMsg);
    } finally {
      setIsRetryingImages(false);
    }
  };

  return (
    <div
      className={`rounded-lg border border-[#E5E7EB] overflow-hidden transition-all ${
        expanded ? "shadow-sm" : ""
      } ${containerTint}`}
    >
      {/* We do accent bar using a flex wrapper */}
      <div className="flex">
      <div className={`w-[3px] ${accentClass}`} />

        <div className="flex-1">
          {/* Message Header */}
          <div
            className={`cursor-pointer transition-all ${
              expanded
                ? "p-4 border-b border-[#F3F4F6]"
                : "px-4 py-3 hover:bg-[#F9FAFB]"
            }`}
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
                      {sanitizeInboundText(message.from_name) || sanitizeInboundText(message.from_address)}
                    </span>

                    {/* Sent/Received chip */}
                    <Badge
                      className={`text-[10px] h-5 ${
                        message.is_outbound
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                      variant="outline"
                    >
                      {directionLabel}
                    </Badge>

                    {/* Optional: new flag (subtle) */}
                    {isNew && (
                      <Badge className="bg-blue-600 text-white text-[10px] h-5">
                        New
                      </Badge>
                    )}
                  </div>

                  {!expanded && (
                    <div className="text-[12px] text-[#9CA3AF] truncate mt-0.5">
                      {(previewText || "(No content)").substring(0, 120)}
                      {previewText.length > 120 ? "…" : ""}
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
                  {message.sent_at &&
                    format(parseISO(message.sent_at), expanded ? "MMM d, h:mm a" : "MMM d")}
                </span>
                <button className="text-[#9CA3AF] hover:text-[#111827] flex-shrink-0">
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="px-5 pt-3 pb-5">
              {/* Compact Metadata */}
              <div className="mb-4 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#111827]">
                      <span className="font-semibold">
                        {message.from_name || message.from_address}
                      </span>
                      {message.from_name && (
                        <span className="text-[#6B7280] ml-1">
                          &lt;{message.from_address}&gt;
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5">
                      to {(message.to_addresses || []).map(sanitizeInboundText).join(", ") || "me"}
                      {message.cc_addresses?.length > 0 && (
                        <span className="ml-1">
                          • cc: {(message.cc_addresses || []).map(sanitizeInboundText).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
                    {message.sent_at &&
                      format(parseISO(message.sent_at), "MMM d, yyyy, h:mm a")}
                  </span>
                </div>
              </div>

              {/* Attachments - Above content */}
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

              {/* Inline Image Error Notice */}
              {inlineImageErrors.size > 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-amber-800">
                    Some inline images couldn't be loaded
                  </span>
                  <Button
                    onClick={handleRetryImages}
                    disabled={isRetryingImages}
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6 px-2 flex-shrink-0 gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRetryingImages ? 'animate-spin' : ''}`} />
                    {isRetryingImages ? 'Retrying...' : 'Retry'}
                  </Button>
                </div>
              )}

              {/* Email Body */}
              <div className="mb-4">
                <div
                  className="gmail-email-body"
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#111827",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {hasNoBody ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-3">
                      <div className="text-[13px] text-amber-900">
                        Content not available yet
                      </div>
                      {message.gmail_thread_id && (
                        <Button
                          onClick={handleReSyncMessage}
                          disabled={isSyncing}
                          size="sm"
                          variant="outline"
                          className="text-[12px] h-7 gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Syncing...' : 'Re-sync'}
                        </Button>
                      )}
                    </div>
                  ) : message.body_html && message.body_html.includes("<") ? (
                    <>
                      {/* Main content */}
                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizedMainHtml,
                        }}
                      />

                      {/* Quoted content (collapsed by default) */}
                      {hasQuoted && (
                        <div className="mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowQuoted((v) => !v);
                            }}
                            className="text-xs font-medium text-[#6B7280] hover:text-[#111827] px-2 py-1 rounded hover:bg-[#F3F4F6] transition-colors"
                          >
                            {showQuoted ? "Hide quoted text" : "Show quoted text"}
                          </button>

                          {showQuoted && (
                            <div className="mt-2 pl-3 border-l border-[#E5E7EB] text-[#374151]">
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: sanitizedQuotedHtml,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : message.body_text ? (
                    <div className="whitespace-pre-wrap">
                      {sanitizeInboundText(message.body_text)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}