import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Mail } from "lucide-react";
import { format } from "date-fns";

export default function LinkEmailThreadModal({ open, onClose, projectId, onLink, isLinking }) {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch threads linked to this project
  const { data: linkedThreads = [] } = useQuery({
    queryKey: ['projectEmailThreads', projectId],
    queryFn: () => base44.entities.EmailThread.filter({ project_id: projectId }),
    enabled: !!projectId && open
  });

  // Fetch all email threads (last 6 months)
  const { data: allThreads = [] } = useQuery({
    queryKey: ['allEmailThreads'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const threads = await base44.entities.EmailThread.list('-last_message_date', 500);
      
      // Filter by date and exclude automatic replies
      return threads.filter(thread => {
        const threadDate = new Date(thread.last_message_date || thread.created_date);
        if (threadDate < sixMonthsAgo) return false;
        
        const subject = (thread.subject || '').toLowerCase();
        const autoReplyPatterns = [
          'auto-reply', 'automatic reply', 'out of office', 'out of the office',
          'away from office', 'delivery status notification', 'undeliverable',
          'mail delivery failed', 'returned mail', 'auto response',
          'vacation reply', 'absence notification'
        ];
        
        return !autoReplyPatterns.some(pattern => subject.includes(pattern));
      });
    },
    enabled: open
  });

  const filteredThreads = React.useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return allThreads.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return allThreads.filter(thread =>
      thread.subject?.toLowerCase().includes(term) ||
      thread.from_address?.toLowerCase().includes(term) ||
      thread.to_addresses?.some(addr => addr.toLowerCase().includes(term))
    ).slice(0, 20);
  }, [allThreads, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Email Thread to Project</DialogTitle>
          <DialogDescription>
            Search and select an email thread to link to this project
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search by subject, sender, or recipient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
          {filteredThreads.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Mail className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
              <p className="text-[14px]">
                {searchTerm.length < 2 ? 'Type at least 2 characters to search' : 'No email threads found'}
              </p>
            </div>
          ) : (
            filteredThreads.map(thread => {
              const isLinked = linkedThreads.some(t => t.id === thread.id);
              const isLinkedElsewhere = thread.project_id && thread.project_id !== projectId;
              
              return (
                <button
                  key={thread.id}
                  onClick={() => !isLinked && onLink(thread.id)}
                  disabled={isLinked || isLinking}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isLinked
                      ? 'bg-green-50 border-green-200 cursor-not-allowed'
                      : isLinkedElsewhere
                        ? 'bg-amber-50 border-amber-200 hover:border-amber-300 cursor-pointer'
                        : 'bg-white border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] text-[#111827] truncate">
                        {thread.subject || '(No subject)'}
                      </div>
                    </div>
                    {isLinked && (
                      <Badge className="bg-green-100 text-green-700 flex-shrink-0">Linked</Badge>
                    )}
                    {isLinkedElsewhere && (
                      <Badge className="bg-amber-100 text-amber-700 flex-shrink-0">Other Project</Badge>
                    )}
                  </div>
                  
                  <div className="text-[13px] text-[#6B7280] mb-1">
                    <strong>From:</strong> {thread.from_address}
                  </div>
                  
                  <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
                    <span>{thread.message_count || 0} message{thread.message_count !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{thread.last_message_date ? format(new Date(thread.last_message_date), 'MMM d, yyyy') : ''}</span>
                  </div>
                  
                  {isLinkedElsewhere && thread.project_title && (
                    <div className="text-[11px] text-amber-700 mt-1">
                      Currently linked to: {thread.project_title}
                    </div>
                  )}
                  
                  {thread.last_message_snippet && (
                    <div className="text-[12px] text-[#9CA3AF] line-clamp-2 mt-2">
                      {thread.last_message_snippet}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <Button variant="outline" onClick={onClose} disabled={isLinking}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}