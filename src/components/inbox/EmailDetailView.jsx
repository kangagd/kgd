import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { sanitizeInboundText } from "@/components/utils/textSanitizers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { showSyncToast } from "@/components/utils/emailSyncToast";

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
  const [loadedCount, setLoadedCount] = useState(30); // Start with 30 newest messages
  
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
    queryKey: ["emailMessages", thread?.id],
    queryFn: async () => {
      try {
        const msgs = await base44.entities.EmailMessage.filter(
          { thread_id: thread?.id },
          "sent_at"
        );
        return msgs.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
      } catch (err) {
        console.error("EmailDetailView messages fetch failed", { threadId: thread?.id, err });
        throw err;
      }
    },
    enabled: !!thread?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
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
        showSyncToast(response.data);
        // Invalidate and refetch messages immediately for responsive UX
        await queryClient.invalidateQueries({ queryKey: ["emailMessages", thread.id] });
        await queryClient.refetchQueries({ queryKey: ["emailMessages", thread.id] });
        // Invalidate threads list to update snippet, message_count, etc.
        await queryClient.invalidateQueries({ queryKey: ["inbox", "threads"] });
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

  /* ---------- paginate messages (show last N) ---------- */
  const visibleMessages = useMemo(() => {
    if (messages.length <= loadedCount) return messages;
    return messages.slice(Math.max(0, messages.length - loadedCount));
  }, [messages, loadedCount]);

  /* ---------- NEW MESSAGES divider index (within visible) ---------- */
  const newStartIndex = useMemo(() => {
    const lastReadAt = initialLastReadAtRef.current;
    if (!lastReadAt) return -1;

    const lastReadTs = new Date(lastReadAt).getTime();
    for (let i = 0; i < visibleMessages.length; i++) {
      const ts = visibleMessages[i]?.sent_at
        ? new Date(visibleMessages[i].sent_at).getTime()
        : 0;
      if (ts > lastReadTs) return i;
    }
    return -1;
  }, [visibleMessages]);

  /* ---------- render ---------- */
  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
          {/* SYNC STATUS BANNER */}
                  {(() => {
                    const partialCount = messages.filter(m => m.sync_status === "partial").length;
                    const failedCount = messages.filter(m => m.sync_status === "failed").length;
                    const missingBodyCount = messages.filter(m => !m.body_html && !m.body_text).length;

                    if (partialCount > 0 || failedCount > 0 || missingBodyCount > 0) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 space-y-1">
                          {partialCount > 0 && (
                            <div className="text-[12px] text-amber-800">
                              <strong>⏳ {partialCount} message{partialCount !== 1 ? 's are' : ' is'} still loading</strong> (partial sync). You may see 'Content not available yet'.
                            </div>
                          )}
                          {failedCount > 0 && (
                            <div className="text-[12px] text-amber-800">
                              <strong>⚠ {failedCount} message{failedCount !== 1 ? 's' : ''} failed to parse.</strong> Body content may be unavailable.
                            </div>
                          )}
                          {missingBodyCount > 0 && partialCount === 0 && failedCount === 0 && (
                            <div className="text-[12px] text-amber-800">
                              <strong>ℹ {missingBodyCount} message{missingBodyCount !== 1 ? 's have' : ' has'} no body content</strong> available for display.
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

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
                <>
                  {/* Load older messages button */}
                  {messages.length > loadedCount && (
                    <div className="px-6 py-3 text-center bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <button
                        onClick={() => setLoadedCount(prev => prev + 30)}
                        className="text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Load {Math.min(30, messages.length - loadedCount)} older messages
                      </button>
                    </div>
                  )}

                  {visibleMessages.map((msg, idx) => {
                   const isNewStart = idx === newStartIndex;

                   const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
                   const prevDay = prevMsg?.sent_at ? getDayKey(prevMsg.sent_at) : null;
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
                    </>
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