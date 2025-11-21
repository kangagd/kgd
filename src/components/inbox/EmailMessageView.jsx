import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Paperclip, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailMessageView({ message, isFirst }) {
  const [expanded, setExpanded] = useState(isFirst);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      {/* Message Header */}
      <div
        className="p-4 cursor-pointer hover:bg-[#F9FAFB] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-semibold text-[#111827]">
                {message.from_name || message.from_address}
              </span>
              {message.is_outbound && (
                <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  Sent
                </span>
              )}
            </div>
            <div className="text-[12px] text-[#6B7280]">
              {message.from_address}
            </div>
            <div className="text-[12px] text-[#6B7280] mt-1">
              {message.sent_at && format(parseISO(message.sent_at), 'MMM d, yyyy • h:mm a')}
            </div>
          </div>
          <button className="text-[#6B7280] hover:text-[#111827]">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {!expanded && message.attachments?.length > 0 && (
          <div className="flex items-center gap-1 mt-2 text-[#6B7280]">
            <Paperclip className="w-3 h-3" />
            <span className="text-[11px]">{message.attachments.length} attachment(s)</span>
          </div>
        )}
      </div>

      {/* Message Body */}
      {expanded && (
        <div className="border-t border-[#E5E7EB] p-4">
          {/* Recipients */}
          {message.to_addresses?.length > 0 && (
            <div className="mb-3 text-[12px]">
              <span className="text-[#6B7280] font-medium">To: </span>
              <span className="text-[#111827]">{message.to_addresses.join(', ')}</span>
            </div>
          )}
          {message.cc_addresses?.length > 0 && (
            <div className="mb-3 text-[12px]">
              <span className="text-[#6B7280] font-medium">CC: </span>
              <span className="text-[#111827]">{message.cc_addresses.join(', ')}</span>
            </div>
          )}

          {/* Body */}
          <div className="mb-4">
            {message.body_html ? (
              <div 
                className="email-content prose prose-sm max-w-none text-[14px] leading-relaxed
                  [&_p]:my-3 [&_p]:leading-relaxed
                  [&_h1]:text-[20px] [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                  [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                  [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                  [&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc
                  [&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal
                  [&_li]:my-1 [&_li]:leading-relaxed
                  [&_blockquote]:border-l-4 [&_blockquote]:border-[#E5E7EB] [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-[#6B7280]
                  [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800
                  [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-4
                  [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                  [&_th]:bg-[#F3F4F6] [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-[#E5E7EB]
                  [&_td]:px-4 [&_td]:py-2 [&_td]:border [&_td]:border-[#E5E7EB]
                  [&_code]:bg-[#F3F4F6] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono
                  [&_pre]:bg-[#1F2937] [&_pre]:text-[#F9FAFB] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#F9FAFB]
                  [&_hr]:my-6 [&_hr]:border-t [&_hr]:border-[#E5E7EB]
                  [&_strong]:font-semibold [&_em]:italic
                  [&_div]:break-words [&_span]:break-words"
                dangerouslySetInnerHTML={{ __html: message.body_html }} 
              />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                {message.body_text}
              </div>
            )}
          </div>

          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="border-t border-[#E5E7EB] pt-4">
              <div className="text-[12px] text-[#6B7280] font-medium mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({message.attachments.length})
              </div>
              <div className="space-y-2">
                {message.attachments.map((attachment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Paperclip className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-[#111827] font-medium truncate">
                          {attachment.filename}
                        </p>
                        {attachment.size && (
                          <p className="text-[11px] text-[#6B7280]">
                            {formatFileSize(attachment.size)}
                          </p>
                        )}
                      </div>
                    </div>
                    {attachment.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="flex-shrink-0"
                      >
                        <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}