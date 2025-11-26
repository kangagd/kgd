import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { Mail, Link as LinkIcon, Trash2, Sparkles, AlertTriangle } from "lucide-react";
import { EmailStatusBadge, EmailPriorityBadge } from "../common/StatusBadge";
import { Badge } from "@/components/ui/badge";

export default function EmailThreadList({ 
  threads, 
  selectedThread, 
  onSelectThread, 
  isLoading,
  selectedThreadIds = [],
  onToggleSelection,
  onSelectAll,
  onBulkDelete,
  onDeleteThread
}) {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#F9FAFB] rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-[#E5E7EB] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#E5E7EB] rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
          <p className="text-[14px] text-[#4B5563]">No emails found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {threads.length > 0 && onSelectAll && (
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-4 py-2 flex items-center gap-3 z-10">
          <Checkbox
            checked={selectedThreadIds.length === threads.length && threads.length > 0}
            onCheckedChange={onSelectAll}
          />
          <span className="text-[13px] text-[#6B7280]">
            Select all {selectedThreadIds.length > 0 && `(${selectedThreadIds.length})`}
          </span>
          {selectedThreadIds.length > 0 && onBulkDelete && (
            <button
              onClick={onBulkDelete}
              className="ml-auto p-1.5 text-[#DC2626] hover:bg-red-50 rounded-md transition-colors"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {threads.map(thread => (
        <div
          key={thread.id}
          className={`p-4 border-b border-[#E5E7EB] cursor-pointer hover:bg-[#F9FAFB] transition-colors ${
            selectedThread?.id === thread.id ? 'bg-[#FAE008]/10 border-l-4 border-l-[#FAE008]' : ''
          } ${selectedThreadIds.includes(thread.id) ? 'bg-[#FAE008]/5' : ''}`}
        >
          <div className="flex items-start justify-between mb-2 group/row">
            <div className="flex items-start gap-3 flex-1 min-w-0 mr-2">
              {onToggleSelection && (
                <Checkbox
                  checked={selectedThreadIds.includes(thread.id)}
                  onCheckedChange={(checked) => {
                    onToggleSelection(thread.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />
              )}
              <div className="flex-1 min-w-0" onClick={() => onSelectThread(thread)}>
                <div className="flex items-center gap-2 mb-1">
                  {!thread.is_read && (
                    <div className="w-2 h-2 bg-[#FAE008] rounded-full flex-shrink-0" />
                  )}
                  <h3 className={`text-[14px] ${!thread.is_read ? 'font-semibold' : 'font-medium'} text-[#111827] truncate`}>
                    {thread.subject}
                  </h3>
                </div>
                <p className="text-[12px] text-[#4B5563] truncate">{thread.from_address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#6B7280] whitespace-nowrap">
                {thread.last_message_date && format(parseISO(thread.last_message_date), 'MMM d')}
              </span>
              {onDeleteThread && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this email thread?')) {
                      onDeleteThread(thread.id);
                    }
                  }}
                  className="p-1 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-red-50 rounded opacity-0 group-hover/row:opacity-100 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div onClick={() => onSelectThread(thread)}>
            <p className="text-[13px] text-[#6B7280] line-clamp-2 mb-2">
              {thread.last_message_snippet}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <EmailStatusBadge value={thread.status} />
              
              {thread.priority !== 'Normal' && (
                <EmailPriorityBadge value={thread.priority} />
              )}

              {/* AI Priority indicator */}
              {thread.ai_priority && thread.ai_priority !== 'Normal' && (
                <Badge 
                  className={`text-[10px] px-1.5 py-0 h-5 ${
                    thread.ai_priority === 'Urgent' 
                      ? 'bg-red-100 text-red-700 border border-red-200' 
                      : thread.ai_priority === 'High'
                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  {thread.ai_priority}
                </Badge>
              )}

              {/* AI Tags - show first 2 */}
              {thread.ai_tags && thread.ai_tags.length > 0 && (
                <>
                  {thread.ai_tags.slice(0, 2).map((tag, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {thread.ai_tags.length > 2 && (
                    <span 
                      className="text-[10px] text-[#6B7280] cursor-help"
                      title={thread.ai_tags.slice(2).join(', ')}
                    >
                      +{thread.ai_tags.length - 2}
                    </span>
                  )}
                </>
              )}

              {(thread.linked_project_id || thread.linked_job_id) && (
                <LinkIcon className="w-3 h-3 text-[#4B5563]" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}