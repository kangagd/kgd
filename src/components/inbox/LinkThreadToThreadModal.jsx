import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Search, Mail, Link2, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function LinkThreadToThreadModal({ 
  open, 
  onClose, 
  currentThreadId,
  existingLinkedIds = [],
  onLink 
}) {
  const [search, setSearch] = useState("");

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['emailThreadsForLinking'],
    queryFn: () => base44.entities.EmailThread.list('-last_message_date'),
    enabled: open
  });

  // Filter out current thread, already linked threads, and deleted threads
  const filteredThreads = threads.filter(thread => {
    if (thread.id === currentThreadId) return false;
    if (thread.is_deleted) return false;
    if (existingLinkedIds.includes(thread.id)) return false;
    
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      thread.subject?.toLowerCase().includes(searchLower) ||
      thread.from_address?.toLowerCase().includes(searchLower) ||
      thread.last_message_snippet?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Related Thread
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <Input
            placeholder="Search threads by subject, sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-[#6B7280]">Loading threads...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              {search ? "No matching threads found" : "No threads available to link"}
            </div>
          ) : (
            filteredThreads.slice(0, 20).map(thread => (
              <button
                key={thread.id}
                onClick={() => onLink(thread)}
                className="w-full p-3 text-left rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#111827] truncate text-sm">
                      {thread.subject || "(No Subject)"}
                    </h4>
                    <p className="text-xs text-[#6B7280] truncate">
                      {thread.from_address}
                    </p>
                    {thread.last_message_date && (
                      <p className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(thread.last_message_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}