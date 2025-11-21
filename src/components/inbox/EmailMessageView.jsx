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
          <div className="prose prose-sm max-w-none mb-4">
            {message.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
            ) : (
              <div className="whitespace-pre-wrap text-[14px] text-[#111827]">
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