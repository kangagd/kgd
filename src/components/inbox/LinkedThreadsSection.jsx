import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Mail, X, Calendar, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";

export default function LinkedThreadsSection({ 
  linkedThreads = [], 
  onAddLink, 
  onRemoveLink,
  onNavigateToThread,
  canEdit = true 
}) {
  if (linkedThreads.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="border border-[#E5E7EB] rounded-xl bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#6B7280]" />
          <h3 className="font-semibold text-[#111827] text-sm">Related Threads</h3>
          {linkedThreads.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {linkedThreads.length}
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddLink}
            className="h-7 text-xs gap-1"
          >
            <Plus className="w-3 h-3" />
            Link Thread
          </Button>
        )}
      </div>

      <div className="p-2">
        {linkedThreads.length === 0 ? (
          <div className="text-center py-4 text-[#9CA3AF] text-sm">
            No related threads linked yet
          </div>
        ) : (
          <div className="space-y-1">
            {linkedThreads.map(thread => (
              <div
                key={thread.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F9FAFB] group"
              >
                <button
                  onClick={() => onNavigateToThread(thread.id)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3.5 h-3.5 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#111827] text-sm truncate">
                      {thread.subject || "(No Subject)"}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <span className="truncate">{thread.from_address}</span>
                      {thread.last_message_date && (
                        <>
                          <span>•</span>
                          <span className="flex-shrink-0">
                            {format(new Date(thread.last_message_date), "MMM d")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                </button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLink(thread.id);
                    }}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#DC2626] hover:text-[#DC2626] hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}