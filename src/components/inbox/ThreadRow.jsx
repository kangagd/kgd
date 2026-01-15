import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Mail,
  MailOpen,
  Send,
  ArrowDown,
  Pin,
  PinOff,
  X,
  Link as LinkIcon,
  Sparkles,
  User,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { getThreadLinkingState } from "@/components/utils/emailThreadLinkingStates";
import {
  getThreadStatusChip,
  isThreadPinned,
  getThreadLinkChip,
} from "@/components/inbox/threadStatusChip";
import { pinThread, unpinThread } from "@/components/inbox/threadPinActions";
import { closeThread, reopenThread } from "@/components/inbox/threadCloseActions";

export default function ThreadRow({
  thread,
  isSelected,
  onClick,
  currentUser,
  onThreadUpdate,
  selectionMode,
  isSelectedForBulk,
  onBulkSelect,
}) {
  const [isPinningLoading, setIsPinningLoading] = useState(false);
  const [isClosingLoading, setIsClosingLoading] = useState(false);
  const [isTogglingRead, setIsTogglingRead] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const linkingState = getThreadLinkingState(thread);
  const statusChip = getThreadStatusChip(thread);
  const isPinned = isThreadPinned(thread);
  const isClosed = thread?.userStatus === "closed";
  const linkChip = getThreadLinkChip(thread);



  const lastMessageDateLabel = useMemo(() => {
    try {
      if (!thread?.last_message_date) return "";
      return format(parseISO(thread.last_message_date), "MMM d, h:mm a");
    } catch {
      return "";
    }
  }, [thread?.last_message_date]);

  const getInitials = (nameOrEmail) => {
    const s = (nameOrEmail || "").trim();
    if (!s) return "—";

    // Email -> use first 2 chars of local part (cleaned)
    if (s.includes("@")) {
      const local = (s.split("@")[0] || "").trim();
      const cleaned = local.replace(/[^a-zA-Z0-9]/g, "");
      const a = cleaned?.[0] || local?.[0] || "";
      const b = cleaned?.[1] || local?.[1] || "";
      const out = `${a}${b}`.toUpperCase().trim();
      return out || "—";
    }

    const parts = s.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1] || "";
    const out = `${first}${second}`.toUpperCase().trim();
    return out || "—";
  };

  const handlePinToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser) return;

    setIsPinningLoading(true);
    try {
      if (isPinned) await unpinThread(thread.id, currentUser.id);
      else await pinThread(thread.id, currentUser.id);
      onThreadUpdate?.();
    } finally {
      setIsPinningLoading(false);
    }
  };

  const handleCloseToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser) return;

    setIsClosingLoading(true);
    try {
      if (isClosed) await reopenThread(thread.id, currentUser.id);
      else await closeThread(thread.id, currentUser.id);
      onThreadUpdate?.();
    } finally {
      setIsClosingLoading(false);
    }
  };

  const handleReadToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser) return;

    setIsTogglingRead(true);
    try {
      const now = new Date().toISOString();
      await base44.entities.EmailThread.update(thread.id, {
        isUnread: !thread.isUnread,
        lastReadAt: thread.isUnread ? now : thread.lastReadAt || null,
        unreadUpdatedAt: now,
      });
      onThreadUpdate?.();
    } finally {
      setIsTogglingRead(false);
    }
  };

  const handleAssignToMe = async (e) => {
    e.stopPropagation();
    if (!currentUser) return;

    setIsAssigning(true);
    try {
      const now = new Date().toISOString();
      await base44.entities.EmailThread.update(thread.id, {
        assigned_to: currentUser.email,
        assigned_to_name: currentUser.display_name || currentUser.full_name,
        assigned_by: currentUser.email,
        assigned_by_name: currentUser.display_name || currentUser.full_name,
        assigned_at: now,
      });
      onThreadUpdate?.();
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div
      className={`w-full px-4 py-3 border-b border-[#E5E7EB] transition-all ${
        isSelected
          ? "bg-[#FAE008]/10 border-l-2 border-l-[#FAE008]"
          : "hover:bg-[#F9FAFB]"
      } ${isSelectedForBulk ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Bulk Selection Checkbox */}
        {selectionMode && (
          <div className="pt-1">
            <Checkbox
              checked={isSelectedForBulk}
              onCheckedChange={(checked) => onBulkSelect?.(thread.id, checked)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <button onClick={onClick} className="flex-1 text-left min-w-0">
          <div className="space-y-2">
            {/* Subject + Chips row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {thread?.isUnread && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                )}
                <h3
                  className={`text-[14px] flex-1 truncate ${
                    thread?.isUnread
                      ? "font-bold text-[#111827]"
                      : "font-semibold text-[#111827]"
                  }`}
                >
                  {thread?.subject || "(No subject)"}
                </h3>
              </div>

              <div className="flex items-center gap-1 flex-wrap flex-shrink-0 justify-end">
                {/* Status Chip */}
                {statusChip && (
                  <Badge
                    variant="outline"
                    className={`text-[11px] border ${statusChip.color}`}
                  >
                    {statusChip.label}
                  </Badge>
                )}

                {/* Pin Toggle */}
                {currentUser && !selectionMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePinToggle}
                    disabled={isPinningLoading}
                    className={`h-6 px-2 text-[11px] flex items-center gap-1 ${
                      isPinned
                        ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        : "text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                    title={isPinned ? "Unpin thread" : "Pin thread"}
                  >
                    {isPinned ? (
                      <>
                        <Pin className="w-3 h-3" />
                        <span>Pinned</span>
                      </>
                    ) : (
                      <PinOff className="w-3 h-3" />
                    )}
                  </Button>
                )}

                {/* Assign to Me */}
                {currentUser && !thread?.assigned_to && !selectionMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAssignToMe}
                    disabled={isAssigning}
                    className="h-6 px-2 text-[11px] flex items-center gap-1 text-[#6B7280] hover:bg-blue-50 hover:text-blue-700"
                    title="Assign to me"
                  >
                    <User className="w-3 h-3" />
                  </Button>
                )}

                {/* Mark Read/Unread */}
                {currentUser && !selectionMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReadToggle}
                    disabled={isTogglingRead}
                    className="h-6 px-2 text-[11px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                    title={thread?.isUnread ? "Mark as read" : "Mark as unread"}
                  >
                    {thread?.isUnread ? (
                      <Mail className="w-3 h-3" />
                    ) : (
                      <MailOpen className="w-3 h-3" />
                    )}
                  </Button>
                )}

                {/* Close/Reopen */}
                {currentUser && !selectionMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCloseToggle}
                    disabled={isClosingLoading}
                    className={`h-6 px-2 text-[11px] flex items-center gap-1 ${
                      isClosed
                        ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                        : "text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                    title={isClosed ? "Reopen thread" : "Mark as closed"}
                  >
                    <X className="w-3 h-3" />
                    {isClosed ? <span>Closed</span> : null}
                  </Button>
                )}

                {/* Link Chip */}
                {linkChip && (
                  <div
                    className="w-5 h-5 bg-green-100 border border-green-200 rounded flex items-center justify-center text-green-700"
                    title={`${linkChip.type === "project" ? "Project" : "Job"}: ${
                      linkChip.title
                    }`}
                  >
                    <LinkIcon className="w-3 h-3" />
                  </div>
                )}

                {/* Legacy AI linking badges */}
                {linkingState.isSuggested && (
                  <Badge className="text-[10px] h-5 bg-yellow-100 text-yellow-700 border-yellow-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Suggested
                  </Badge>
                )}
                {linkingState.isIgnored && (
                  <Badge className="text-[10px] h-5 bg-slate-100 text-slate-600 border-slate-200">
                    Dismissed
                  </Badge>
                )}
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              {thread?.customer_name && (
                <span className="truncate">{thread.customer_name}</span>
              )}
            </div>

            {/* Preview + Assignee avatar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#9CA3AF] truncate">
                  {thread?.last_message_snippet || "No messages"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {thread?.assigned_to && (
                  <div
                    className="w-6 h-6 rounded-full bg-[#FAE008]/20 flex items-center justify-center border border-[#FAE008]/30 flex-shrink-0"
                    title={thread?.assigned_to_name || thread?.assigned_to}
                  >
                    <span className="text-[10px] font-semibold text-[#111827]">
                      {getInitials(thread?.assigned_to_name || thread?.assigned_to)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Last Message Date */}
            {lastMessageDateLabel && (
              <div className="text-[11px] text-[#9CA3AF]">{lastMessageDateLabel}</div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}