import React from "react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Mail, Paperclip, Link as LinkIcon } from "lucide-react";

const statusColors = {
  "Open": "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-amber-100 text-amber-800 border-amber-200",
  "Closed": "bg-gray-100 text-gray-800 border-gray-200",
  "Archived": "bg-slate-100 text-slate-600 border-slate-200"
};

const priorityColors = {
  "Low": "bg-gray-100 text-gray-600",
  "Normal": "bg-blue-100 text-blue-700",
  "High": "bg-red-100 text-red-700"
};

export default function EmailThreadList({ threads, selectedThread, onSelectThread, isLoading }) {
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
      {threads.map(thread => (
        <div
          key={thread.id}
          onClick={() => onSelectThread(thread)}
          className={`p-4 border-b border-[#E5E7EB] cursor-pointer hover:bg-[#F9FAFB] transition-colors ${
            selectedThread?.id === thread.id ? 'bg-[#FAE008]/10 border-l-4 border-l-[#FAE008]' : ''
          } ${thread.is_urgent ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0 mr-2">
              <div className="flex items-center gap-2 mb-1">
                {thread.is_urgent && (
                  <span className="text-[16px]">🚨</span>
                )}
                {!thread.is_read && (
                  <div className="w-2 h-2 bg-[#FAE008] rounded-full flex-shrink-0" />
                )}
                <h3 className={`text-[14px] ${!thread.is_read ? 'font-semibold' : 'font-medium'} text-[#111827] truncate`}>
                  {thread.subject}
                </h3>
              </div>
              <p className="text-[12px] text-[#4B5563] truncate">{thread.from_address}</p>
            </div>
            <span className="text-[11px] text-[#6B7280] whitespace-nowrap">
              {thread.last_message_date && format(parseISO(thread.last_message_date), 'MMM d')}
            </span>
          </div>

          <p className="text-[13px] text-[#6B7280] line-clamp-2 mb-2">
            {thread.last_message_snippet}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {thread.category && thread.category !== 'Uncategorized' && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[11px] px-2 py-0.5">
                {thread.category}
              </Badge>
            )}
            
            <Badge className={`${statusColors[thread.status]} text-[11px] px-2 py-0.5`}>
              {thread.status}
            </Badge>
            
            {thread.priority !== 'Normal' && (
              <Badge className={`${priorityColors[thread.priority]} text-[11px] px-2 py-0.5`}>
                {thread.priority}
              </Badge>
            )}

            {(thread.linked_project_id || thread.linked_job_id) && (
              <LinkIcon className="w-3 h-3 text-[#4B5563]" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}