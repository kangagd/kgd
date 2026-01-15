import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { sanitizeInboundText } from "@/components/utils/textSanitizers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import EmailMessageItem from "./EmailMessageItem";

/* ---------- helpers ---------- */
const getDayKey = (iso) => {
  if (!iso) return "unknown";
  return format(parseISO(iso), "yyyy-MM-dd");
};

const formatDayLabel = (iso) => {
  if (!iso) return "";
  return format(parseISO(iso), "EEE, MMM d");
};
/* ----------------------------- */

export default function EmailDetailView({ thread, onThreadUpdate }) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  
  /* ---------- preserve lastReadAt for divider ---------- */
  const initialLastReadAtRef = useRef(thread?.lastReadAt || null);

  useEffect(() => {
    initialLastReadAtRef.current = thread?.lastReadAt || null;
  }, [thread?.id]);

  /* ---------- getSenderInitials (REQUIRED by EmailMessageItem) ---------- */
  const getSenderInitials = (name, email) => {
    if (name && typeof name === "string") {
      const parts = name.trim().split(" ").filter(Boolean);
      if (parts.length > 1 && parts[0][0] && parts[1][0]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      if (parts.length > 0 && parts[0][0]) {
        return parts[0][0].toUpperCase();
      }
    }
    if (email && typeof email === "string" && email[0]) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  /* ---------- mark as read (unchanged logic) ---------- */
  useEffect(() => {
    if (thread?.id && thread.isUnread) {
      const timer = setTimeout(async () => {
        try {
          await base44.entities.EmailThread.update(thread.id, {
            isUnread: false,
            lastReadAt: new Date().toISOString(),
          });
          onThreadUpdate?.();
        } catch {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [thread?.id, thread?.isUnread, onThreadUpdate]);

  /* ---------- messages ---------- */
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["emailMessages", thread.id],
    queryFn: async () => {
      const msgs = await base44.entities.EmailMessage.filter(
        { thread_id: thread.id },
        "sent_at"
      );
      return msgs.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
    },
    enabled: !!thread?.id,
    staleTime: 30000,
  });

  /* ---------- sync thread messages ---------- */
  const handleSyncMessages = async () => {
    if (!thread?.gmail_thread_id) {
      toast.error('This thread is missing Gmail IDs; cannot sync messages.');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('gmailSyncThreadMessages', {
        gmail_thread_id: thread.gmail_thread_id,
      });

      if (response.data?.success) {
        // Smart toast based on sync results
        const { okCount = 0, partialCount = 0, failedCount = 0 } = response.data || {};
        
        if (okCount > 0) {
          toast.success('Messages synced');
        } else if (okCount === 0 && partialCount > 0) {
          toast.warning('Messages updated, but content is still unavailable. Try again.');
        } else if (failedCount > 0) {
          toast.error('Some messages failed to sync');
        }
        
        // Refetch messages and thread
        await queryClient.invalidateQueries({ queryKey: ["emailMessages", thread.id] });
        onThreadUpdate?.();
      } else {
        toast.error('Failed to sync messages');
      }
    } catch (error) {
      console.error('Error syncing messages:', error);
      toast.error('Error syncing messages');
    } finally {
      setIsSyncing(false);
    }
  };

  /* ---------- NEW MESSAGES divider index ---------- */
  const newStartIndex = useMemo(() => {
    const lastReadAt = initialLastReadAtRef.current;
    if (!lastReadAt) return -1;

    const lastReadTs = new Date(lastReadAt).getTime();
    for (let i = 0; i < messages.length; i++) {
      const ts = messages[i]?.sent_at
        ? new Date(messages[i].sent_at).getTime()
        : 0;
      if (ts > lastReadTs) return i;
    }
    return -1;
  }, [messages]);

  /* ---------- render ---------- */
  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
          {/* THREAD SUBJECT */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden mb-6">
            <div className="p-6 border-b border-[#E5E7EB]">
              <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827]">
                {sanitizeInboundText(thread.subject) || "(No subject)"}
              </h1>
            </div>

            {/* MESSAGE LIST */}
            <div className="divide-y divide-[#E5E7EB]">
              {messagesLoading ? (
                <div className="text-[14px] text-[#6B7280] text-center py-8">
                  Loading messages…
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, idx) => {
                  const isNewStart = idx === newStartIndex;

                  const prev = messages[idx - 1];
                  const prevDay = prev?.sent_at ? getDayKey(prev.sent_at) : null;
                  const currDay = msg?.sent_at ? getDayKey(msg.sent_at) : null;

                  const showDayDivider =
                    idx === 0 || (prevDay && currDay && prevDay !== currDay);

                  return (
                    <React.Fragment key={msg.id}>
                      {/* DATE DIVIDER */}
                      {showDayDivider && (
                        <div className="bg-[#F9FAFB] px-6 py-2 text-xs font-medium text-[#6B7280] flex items-center gap-3">
                          <div className="h-px bg-[#E5E7EB] flex-1" />
                          <span>{formatDayLabel(msg.sent_at)}</span>
                          <div className="h-px bg-[#E5E7EB] flex-1" />
                        </div>
                      )}

                      {/* NEW MESSAGES DIVIDER */}
                      {isNewStart && (
                        <div className="bg-blue-50 px-6 py-2 text-xs font-semibold text-blue-700 flex items-center gap-3">
                          <div className="h-px bg-blue-200 flex-1" />
                          <span>NEW MESSAGES</span>
                          <div className="h-px bg-blue-200 flex-1" />
                        </div>
                      )}

                      <EmailMessageItem
                        message={msg}
                        isLast={idx === messages.length - 1}
                        totalMessages={messages.length}
                        getSenderInitials={getSenderInitials}
                        isNew={newStartIndex !== -1 && idx >= newStartIndex}
                        threadId={thread.id}
                        onResyncMessage={() => {
                          queryClient.invalidateQueries({ queryKey: ["emailMessages", thread.id] });
                        }}
                      />
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="text-[14px] text-[#6B7280] text-center py-8 space-y-4">
                  <p>Messages for this thread haven't been synced yet.</p>
                  {thread?.gmail_thread_id ? (
                    <Button
                      onClick={handleSyncMessages}
                      disabled={isSyncing}
                      size="sm"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync this thread'}
                    </Button>
                  ) : (
                    <p className="text-xs text-red-600">
                      This thread is missing Gmail IDs; cannot sync messages.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}