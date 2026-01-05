import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, User, FileText, Target } from "lucide-react";

export default function ManualActivityModal({ open, onClose, activity }) {
  if (!activity) return null;

  // Parse content to extract structured data
  const parseActivity = (content) => {
    const lines = content.split('\n\n');
    const firstLine = lines[0];
    
    // Extract type and contact name
    const typeMatch = firstLine.match(/\*\*\[(.+?)\]\*\*/);
    const contactMatch = firstLine.match(/with (.+)$/);
    const type = typeMatch ? typeMatch[1] : null;
    const contactName = contactMatch ? contactMatch[1] : null;
    
    // Extract summary (everything after first line until Outcome)
    const summaryMatch = content.match(/\]\*\*.*?\n\n([\s\S]*?)(?:\n\n\*\*Outcome:\*\*|$)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : content;
    
    // Extract outcome
    const outcomeMatch = content.match(/\*\*Outcome:\*\*\s*([\s\S]*?)$/);
    const outcome = outcomeMatch ? outcomeMatch[1].trim() : null;
    
    return { type, contactName, summary, outcome };
  };

  const { type, contactName, summary, outcome } = parseActivity(activity.content);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activity Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Header Info */}
          <div className="flex items-center gap-3 flex-wrap">
            {type && (
              <Badge variant="secondary" className="text-sm">
                {type}
              </Badge>
            )}
            {activity.activity_date && (
              <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(activity.activity_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Contact Name */}
          {contactName && (
            <div className="bg-[#F9FAFB] rounded-lg p-3">
              <div className="flex items-center gap-2 text-[#4B5563]">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Contact:</span>
                <span className="text-sm">{contactName}</span>
              </div>
            </div>
          )}

          {/* Summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              <span className="text-sm font-medium text-[#111827]">Summary</span>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[14px] text-[#4B5563] whitespace-pre-wrap leading-relaxed">
                {summary}
              </p>
            </div>
          </div>

          {/* Outcome */}
          {outcome && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#6B7280]" />
                <span className="text-sm font-medium text-[#111827]">Outcome</span>
              </div>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-4">
                <p className="text-[14px] text-[#15803D] whitespace-pre-wrap leading-relaxed">
                  {outcome}
                </p>
              </div>
            </div>
          )}

          {/* Attachments */}
          {activity.attachments && activity.attachments.length > 0 && (
            <div>
              <span className="text-sm font-medium text-[#111827] mb-2 block">
                Attachments ({activity.attachments.length})
              </span>
              <div className="space-y-2">
                {activity.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#F9FAFB] hover:bg-[#F3F4F6] p-3 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm text-[#111827] truncate flex-1">
                      {att.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Logged By */}
          <div className="pt-3 border-t border-[#E5E7EB]">
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <span>Logged by {activity.sender_name}</span>
              <span>•</span>
              <span>{format(new Date(activity.created_date), 'MMM d, yyyy h:mm a')}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}