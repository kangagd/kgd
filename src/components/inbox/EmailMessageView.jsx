import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Paperclip, Download, Save, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function EmailMessageView({ message, isFirst, linkedJobId, linkedProjectId, onSaveAttachment }) {
  const [expanded, setExpanded] = useState(isFirst);
  const [savingAttachment, setSavingAttachment] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

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

  const getAttachmentIcon = (mimeType) => {
    if (!mimeType) return FileText;
    if (mimeType.startsWith('image/')) return ImageIcon;
    return FileText;
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
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[15px] font-semibold text-[#111827]">
                {message.from_name || message.from_address}
              </span>
              {message.is_outbound && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[11px] h-5">
                  Sent
                </Badge>
              )}
              {!expanded && message.attachments?.length > 0 && (
                <Badge variant="outline" className="text-[11px] h-5 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {message.attachments.length}
                </Badge>
              )}
            </div>
            <div className="text-[13px] text-[#6B7280] mb-1">
              {message.from_address}
            </div>
            <div className="text-[12px] text-[#9CA3AF]">
              {message.sent_at && format(parseISO(message.sent_at), 'EEEE, MMMM d, yyyy • h:mm a')}
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

          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="border-t border-[#F3F4F6] pt-5">
              <div className="text-[13px] text-[#6B7280] font-semibold mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({message.attachments.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.attachments.map((attachment, idx) => {
                  const AttachmentIcon = getAttachmentIcon(attachment.mime_type);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                          <AttachmentIcon className="w-4 h-4 text-[#6B7280]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[#111827] font-medium truncate">
                            {attachment.filename}
                          </p>
                          {attachment.size > 0 && (
                            <p className="text-[11px] text-[#6B7280] mt-0.5">
                              {formatFileSize(attachment.size)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {(linkedJobId || linkedProjectId) && onSaveAttachment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSavingAttachment(idx);
                              onSaveAttachment(attachment, () => setSavingAttachment(null));
                            }}
                            disabled={savingAttachment === idx}
                            title={`Save to ${linkedJobId ? 'Job' : 'Project'}`}
                            className="h-8 w-8 p-0"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        )}
                        {attachment.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0"
                          >
                            <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
          )}
    </div>
  );
}