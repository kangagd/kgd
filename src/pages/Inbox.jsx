import { useState, useEffect, useMemo, useRef } from "react";
import { devLog } from "@/components/utils/devLog";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/components/api/queryConfig";
import { inboxKeys } from "@/components/api/queryKeys";
import {
  Mail,
  Loader,
  History,
  CheckSquare,
  X as XIcon,
  Link as LinkIcon,
  MailOpen,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ThreadRow from "@/components/inbox/ThreadRow";
import ThreadHeader from "@/components/inbox/ThreadHeader";
import InboxFilterBar from "@/components/inbox/InboxFilterBar";

import EmailDetailView from "@/components/inbox/EmailDetailView";
import LinkThreadModal from "@/components/inbox/LinkThreadModal";
import CreateProjectFromEmailModal from "@/components/inbox/CreateProjectFromEmailModal";
import GmailHistorySearchModal from "@/components/inbox/GmailHistorySearchModal";
import DraftsList from "@/components/inbox/DraftsList";
import UnifiedEmailComposer from "@/components/inbox/UnifiedEmailComposer";

/* -------------------------
   Direction helpers
-------------------------- */
const normalizeEmail = (e) => (e || "").toLowerCase().trim();
const safeTs = (iso) => {
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Best-effort UI direction:
 * 1) If lastInternalMessageAt matches last_message_date => sent
 * 2) If lastExternalMessageAt matches last_message_date => received
 * 3) Else fallback to email matching (from_address / to_addresses) vs org emails
 * 4) Else use stored lastMessageDirection
 */
const inferThreadDirection = (thread, orgEmails = []) => {
  const lastMsgTs = safeTs(thread?.last_message_date);
  const lastInternalTs = safeTs(thread?.lastInternalMessageAt);
  const lastExternalTs = safeTs(thread?.lastExternalMessageAt);

  if (lastMsgTs && lastInternalTs && lastInternalTs === lastMsgTs) return "sent";
  if (lastMsgTs && lastExternalTs && lastExternalTs === lastMsgTs) return "received";

  const mine = new Set((orgEmails || []).map(normalizeEmail).filter(Boolean));
  const from = normalizeEmail(thread?.from_address);
  const toList = (thread?.to_addresses || []).map(normalizeEmail).filter(Boolean);

  if (from && mine.has(from)) return "sent";
  if (toList.some((e) => mine.has(e))) return "received";

  return thread?.lastMessageDirection || "unknown";
};

export default function Inbox() {
   const queryClient = useQueryClient();
   const mountedRef = useRef(true);
   const syncInFlightRef = useRef(false);
   const [user, setUser] = useState(null);
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilters, setActiveFilters] = useState({});
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // NOTE: `showComposer`/`composerMessage` removed (GUARDRAIL: use composerOpen/composerMode instead - controls both visibility and mode)
  // Composer state consolidated into: composerOpen, composerMode, composerThreadId, composerDraftId, composerLastMessage
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastThreadFetchTime, setLastThreadFetchTime] = useState(0);
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [activeView, setActiveView] = useState("inbox"); // inbox | drafts
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraftId, setComposerDraftId] = useState(null);
  const [composerThreadId, setComposerThreadId] = useState(null);
  const [composerMode, setComposerMode] = useState("new");
  const [composerLastMessage, setComposerLastMessage] = useState(null);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState(new Set());
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedMessageForProject, setSelectedMessageForProject] = useState(null);

  // Cleanup on unmount to avoid setState warnings and reset sync lock
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      syncInFlightRef.current = false;
    };
  }, []);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        devLog("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  // Handle threadId from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("threadId");
    if (threadId && threadId !== selectedThreadId) {
      setSelectedThreadId(threadId);
    }
  }, []);

  const { data: initialThreads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: inboxKeys.threads(),
    queryFn: async () => {
      devLog(`[Inbox] queryFn STARTED - user=${user?.email}`);
      setLastThreadFetchTime(Date.now());
      devLog('[Inbox] Fetch threads via backend function');
      try {
        const response = await base44.functions.invoke("getMyEmailThreads", { limit: 100 });
        const fetchedThreads = response.data?.threads || [];

        const result = fetchedThreads
          .filter((t) => !t.is_deleted)
          .map((thread) => ({
            ...thread,
            viewers: [],
          }));

        devLog(`[Inbox] queryFn RETURNING ${result.length} threads`);
        return result;
      } catch (error) {
        devLog(`[Inbox] Error fetching threads:`, error);
        toast.error("Failed to load threads");
        return [];
      }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    ...QUERY_CONFIG.reference,
    onSuccess: (newThreads) => {
      devLog(`[Inbox] onSuccess - newThreads.length=${newThreads.length}`);
      setCursor(newThreads.length > 0 ? newThreads[newThreads.length - 1].last_message_date : null);
      setHasMore(newThreads.length === 100);
      if (selectedThreadId && !newThreads.find((t) => t.id === selectedThreadId)) {
        const currentIndex = newThreads.findIndex((t) => t.id === selectedThreadId);
        const nextThread = newThreads[Math.min(currentIndex, newThreads.length - 1)];
        setSelectedThreadId(nextThread?.id || null);
      }
    },
  });

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const moreThreads = await base44.entities.EmailThread.list("-last_message_date", 100);
      const filtered = moreThreads
        .filter((t) => !t.is_deleted && new Date(t.last_message_date).getTime() < new Date(cursor).getTime())
        .slice(0, 100);

      if (filtered.length > 0) {
        await refetchThreads();
        setCursor(filtered[filtered.length - 1].last_message_date);
        setHasMore(filtered.length === 100);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      devLog('Failed to load more threads:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const threads = initialThreads;

  // Real-time subscription for EmailThread updates (debounced with staleTime gating)
  useEffect(() => {
    if (!user) return;

    let debounceTimer;
    const unsubscribe = base44.entities.EmailThread.subscribe(() => {
      const now = Date.now();
      // Only refetch if stale (> 5 minutes old)
      if (now - lastThreadFetchTime < 5 * 60 * 1000) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
      }, 1000);
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [user, queryClient, lastThreadFetchTime]);

  // Sync Gmail inbox + messages (orchestrated with component-level mutex)
  const syncGmailInbox = async () => {
    // Check if sync already in flight (component-level)
    if (syncInFlightRef.current) {
      devLog('[Inbox] Sync already in flight');
      return;
    }

    // Check local state
    if (isSyncing) {
      devLog('[Inbox] Sync already in progress locally');
      return;
    }

    const now = Date.now();
    // Throttle: do not sync more frequently than every 60 seconds
    if (lastSyncTime && now - new Date(lastSyncTime).getTime() < 60000) {
      devLog(`[Inbox] Sync throttled: last sync ${Math.round((now - new Date(lastSyncTime).getTime()) / 1000)}s ago`);
      return;
    }

    // Set sync in progress
    syncInFlightRef.current = true;
    try {
      if (mountedRef.current) setIsSyncing(true);
      
      const result = await base44.functions.invoke("gmailSyncOrchestrated", {});

      // Handle sync lock (already in progress on backend)
      if (result?.skipped && result?.reason === 'locked') {
        devLog(`[Inbox] Sync already running, locked until ${result.locked_until}`);
        if (mountedRef.current) toast.info("Sync already running. Please wait and try again.", { duration: 3000 });
        return;
      }

      if (result?.summary) {
        devLog(
                   `[Inbox] Sync complete: ${result.summary.threads_synced} threads, ${result.summary.messages_synced} messages`
                 );
      }

      if (mountedRef.current) {
        await refetchThreads();
        setLastSyncTime(new Date());
      }

      if (result?.errors?.length) devLog("Sync completed with errors:", result.errors);
    } catch (error) {
      devLog("Sync failed:", error);
      if (mountedRef.current) toast.error("Failed to sync emails");
    } finally {
      if (mountedRef.current) setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  };

  // Auto-sync on mount and when tab becomes visible (with throttle)
  useEffect(() => {
    if (!user) return;

    syncGmailInbox();

    let visibilityTimeout;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          const now = Date.now();
          // Only auto-sync if threads data is > 10 minutes stale
          if (now - lastThreadFetchTime >= 10 * 60 * 1000) {
            syncGmailInbox();
          }
        }, 500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(visibilityTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, lastThreadFetchTime]);

  const { data: teamUsers = [] } = useQuery({
    queryKey: ["teamUsers"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
    ...QUERY_CONFIG.reference,
  });

  // Org emails for direction inference
  const orgEmails = useMemo(() => {
    const set = new Set();
    if (user?.email) set.add(normalizeEmail(user.email));
    (teamUsers || []).forEach((u) => {
      if (u?.email) set.add(normalizeEmail(u.email));
      if (Array.isArray(u?.aliases)) u.aliases.forEach((a) => a && set.add(normalizeEmail(a)));
    });
    return Array.from(set);
  }, [user?.email, teamUsers]);

  const { data: threadDrafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: inboxKeys.drafts(),
    queryFn: async () => {
      if (!selectedThreadId || !user) return [];
      return base44.entities.EmailDraft.filter(
        { thread_id: selectedThreadId, created_by: user.email },
        "-updated_date"
      );
    },
    enabled: !!selectedThreadId && !!user,
    ...QUERY_CONFIG.reference,
  });

  // Apply filters and search with proper sorting
  const filteredThreads = useMemo(() => {
    console.log('[FILTER DEBUG] START threads.length=', threads?.length);
    let result = (threads || [])
      .filter((t) => !t.is_deleted);
    
    console.log('[FILTER DEBUG] After is_deleted filter:', result.length);
    
    result = result.map((t) => ({
      ...t,
      inferredDirection: inferThreadDirection(t, orgEmails),
    }));

    devLog('[Inbox] After inferredDirection map:', result.length);

    if (result.length > 0 && result.length <= 5) {
      devLog('[Inbox] Sample threads before filter:', result.map(t => ({ id: t.id, userStatus: t.userStatus, isUnread: t.isUnread })));
    }

    // Text search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject?.toLowerCase().includes(search) ||
          t.customer_name?.toLowerCase().includes(search) ||
          t.from_address?.toLowerCase().includes(search) ||
          t.to_addresses?.some((addr) => addr?.toLowerCase().includes(search)) ||
          t.last_message_snippet?.toLowerCase().includes(search)
      );
      devLog('[Inbox] After search filter:', result.length);
    }

    // If NO filters are active, return all threads
    const hasActiveFilters = Object.values(activeFilters).some(v => v === true);
    devLog('[Inbox] hasActiveFilters:', hasActiveFilters, 'result.length before filter:', result.length);
    if (!hasActiveFilters) {
      // No filters: return all non-deleted threads (already filtered above)
    } else if (activeFilters["closed"]) {
      result = result.filter((t) => t.userStatus === "closed");
    } else if (activeFilters["assigned-to-me"]) {
      result = result.filter((t) => t.assigned_to === user.email);
    } else if (activeFilters["sent"]) {
      result = result.filter((t) => t.inferredDirection === "sent");
    } else if (activeFilters["received"]) {
      result = result.filter((t) => t.inferredDirection === "received");
    } else if (activeFilters["pinned"]) {
      result = result.filter((t) => t.pinnedAt);
    } else if (activeFilters["linked"]) {
      result = result.filter((t) => t.project_id || t.contract_id);
    } else if (activeFilters["unlinked"]) {
      result = result.filter((t) => !t.project_id && !t.contract_id);
    }

    // Sorting: pinned > unread > by date
    result.sort((a, b) => {
      const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      const aTime = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
      const bTime = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
      return bTime - aTime;
    });

    console.log('[FILTER DEBUG] FINAL result.length=', result.length);
    return result;
  }, [threads, searchTerm, activeFilters, user?.email, orgEmails]);

  const selectedThread = useMemo(() => {
    return selectedThreadId ? threads.find((t) => t.id === selectedThreadId) : null;
  }, [selectedThreadId, threads]);

  // Handle status changes
  const handleStatusChange = async (newStatus) => {
    if (!selectedThread) return;
    try {
      await base44.entities.EmailThread.update(selectedThread.id, { status: newStatus });
      await refetchThreads();
      toast.success(`Status changed to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Handle assignment changes
  const handleAssignChange = async (userEmail) => {
    if (!selectedThread) return;
    try {
      const assignedUser = teamUsers.find((u) => u.email === userEmail);
      await base44.entities.EmailThread.update(selectedThread.id, {
        assigned_to: userEmail || null,
        assigned_to_name: assignedUser?.full_name || null,
      });
      await refetchThreads();
      toast.success(userEmail ? `Assigned to ${assignedUser?.full_name}` : "Unassigned");
    } catch {
      toast.error("Failed to assign thread");
    }
  };

  // Track thread view (debounced - only update once per 10 seconds)
  useEffect(() => {
    if (!selectedThread || !user) return;

    const timeout = setTimeout(() => {
      base44.functions.invoke('updateEmailThreadViewerLastSeen', {
        thread_id: selectedThread.id,
      }).catch(() => {});
    }, 10000);

    return () => clearTimeout(timeout);
  }, [selectedThread?.id, user?.email]);

  // Composer sent
  const handleComposerSent = async () => {
    await refetchThreads();
    await refetchDrafts();
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: inboxKeys.thread(selectedThread.id) });
    }
  };

  // Bulk actions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedThreadIds(new Set());
  };

  const handleBulkSelect = (threadId, checked) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(threadId);
      else next.delete(threadId);
      return next;
    });
  };

  const selectAllThreads = () => setSelectedThreadIds(new Set(filteredThreads.map((t) => t.id)));
  const deselectAllThreads = () => setSelectedThreadIds(new Set());

  const bulkMarkAsRead = async () => {
    const count = selectedThreadIds.size;
    try {
      const now = new Date().toISOString();
      await Promise.all(
        Array.from(selectedThreadIds).map((id) =>
          base44.entities.EmailThread.update(id, {
            isUnread: false,
            lastReadAt: now,
            unreadUpdatedAt: now,
          })
        )
      );
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Marked ${count} thread${count !== 1 ? "s" : ""} as read`);
    } catch {
      toast.error("Failed to mark threads as read");
    }
  };

  const bulkMarkAsUnread = async () => {
    const count = selectedThreadIds.size;
    try {
      const now = new Date().toISOString();
      await Promise.all(
        Array.from(selectedThreadIds).map((id) =>
          base44.entities.EmailThread.update(id, {
            isUnread: true,
            unreadUpdatedAt: now,
          })
        )
      );
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Marked ${count} thread${count !== 1 ? "s" : ""} as unread`);
    } catch {
      toast.error("Failed to mark threads as unread");
    }
  };

  const bulkClose = async () => {
    const count = selectedThreadIds.size;
    try {
      await Promise.all(
        Array.from(selectedThreadIds).map((id) => base44.entities.EmailThread.update(id, { userStatus: "closed" }))
      );
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Closed ${count} thread${count !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to close threads");
    }
  };

  const bulkAssignToMe = async () => {
    const count = selectedThreadIds.size;
    try {
      const now = new Date().toISOString();
      await Promise.all(
        Array.from(selectedThreadIds).map((id) =>
          base44.entities.EmailThread.update(id, {
            assigned_to: user.email,
            assigned_to_name: user.display_name || user.full_name,
            assigned_by: user.email,
            assigned_by_name: user.display_name || user.full_name,
            assigned_at: now,
          })
        )
      );
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Assigned ${count} thread${count !== 1 ? "s" : ""} to you`);
    } catch {
      toast.error("Failed to assign threads");
    }
  };

  const bulkLinkMutation = useMutation({
    mutationFn: async ({ projectId, contractId, linkType, count }) => {
      if (linkType === 'project') {
        await Promise.all(
          Array.from(selectedThreadIds).map((id) =>
            base44.functions.invoke('linkEmailThreadToProject', { threadId: id, projectId })
          )
        );
      } else if (linkType === 'contract') {
        await Promise.all(
          Array.from(selectedThreadIds).map((id) =>
            base44.functions.invoke('linkEmailThreadToContract', { threadId: id, contractId })
          )
        );
      }
      return count;
    },
    onSuccess: (count) => {
      refetchThreads();
      setShowBulkLinkModal(false);
      setSelectedThreadIds(new Set());
      toast.success(`Linked ${count} thread${count !== 1 ? "s" : ""}`);
    },
    onError: () => toast.error("Failed to link threads"),
  });

  const linkThreadMutation = useMutation({
    mutationFn: async ({ projectId }) => {
      if (!selectedThread) return;
      const response = await base44.functions.invoke('linkEmailThreadToProject', {
        threadId: selectedThread.id,
        projectId
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to link thread');
      }
    },
    onSuccess: () => {
      refetchThreads();
      setShowLinkModal(false);
      toast.success("Thread linked to project");
    },
    onError: (error) => toast.error(error.message || "Failed to link thread"),
  });

  const linkContractMutation = useMutation({
    mutationFn: async ({ contractId }) => {
      if (!selectedThread) return;
      const response = await base44.functions.invoke('linkEmailThreadToContract', {
        threadId: selectedThread.id,
        contractId
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to link thread to contract');
      }
    },
    onSuccess: () => {
      refetchThreads();
      setShowLinkModal(false);
      toast.success("Thread linked to contract");
    },
    onError: (error) => toast.error(error.message || "Failed to link thread to contract"),
  });

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader className="w-5 h-5 animate-spin text-[#FAE008]" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* Left pane */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-[#E5E7EB] overflow-hidden">
          {/* Bulk toolbar */}
          {selectionMode && selectedThreadIds.size > 0 && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-blue-700">{selectedThreadIds.size} selected</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={bulkMarkAsRead} className="h-7 px-2 text-xs hover:bg-blue-100" title="Mark as read">
                  <MailOpen className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={bulkMarkAsUnread} className="h-7 px-2 text-xs hover:bg-blue-100" title="Mark as unread">
                  <Mail className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={bulkAssignToMe} className="h-7 px-2 text-xs hover:bg-blue-100" title="Assign to me">
                  <UserPlus className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={bulkClose} className="h-7 px-2 text-xs hover:bg-blue-100" title="Close">
                  <XIcon className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBulkLinkModal(true)} className="h-7 px-2 text-xs hover:bg-blue-100" title="Link to project">
                  <LinkIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Tabs + compose + selection toggle */}
          <div className="px-3 py-2 border-b border-[#E5E7EB] flex gap-2 items-center">
            <button
              onClick={() => {
                setActiveView("inbox");
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedThreadIds(new Set());
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === "inbox" ? "bg-[#FAE008] text-[#111827]" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => {
                setActiveView("drafts");
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedThreadIds(new Set());
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === "drafts" ? "bg-[#FAE008] text-[#111827]" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
            >
              Drafts
            </button>

            <button
              onClick={() => {
                setComposerMode("new");
                setComposerThreadId(null);
                setComposerDraftId(null);
                setComposerOpen(true);
              }}
              className="ml-auto px-3 py-1.5 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              Compose
            </button>

            {activeView === "inbox" && (
              <button
                onClick={toggleSelectionMode}
                className={`p-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectionMode ? "bg-blue-100 text-blue-700" : "text-[#6B7280] hover:bg-[#F3F4F6]"
                }`}
                title={selectionMode ? "Exit selection mode" : "Select threads"}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selection mode actions */}
          {selectionMode && activeView === "inbox" && (
            <div className="px-3 py-2 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" onClick={selectAllThreads} className="text-xs">
                Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAllThreads} className="text-xs">
                Deselect All
              </Button>
            </div>
          )}

          {/* Filter bar */}
          {activeView === "inbox" && !selectionMode && (
            <InboxFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFilterChange={(filterId, filterValue) => {
                if (filterId === "clear") setActiveFilters({});
                else {
                  setActiveFilters((prev) => ({
                    ...prev,
                    [filterId]: filterValue ? true : false,
                  }));
                }
              }}
              userEmail={user?.email}
            />
          )}

          {/* Sync info */}
          <div className="px-3 py-2 border-b border-[#E5E7EB] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>
                {isSyncing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader className="w-3 h-3 animate-spin" />
                    Syncing...
                  </span>
                ) : lastSyncTime ? (
                  `Last synced: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                ) : (
                  "Not synced yet"
                )}
              </span>
            </div>
            <button
              onClick={() => setShowHistorySearch(true)}
              disabled={isSyncing}
              className={`w-full px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                isSyncing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
              }`}
              title={isSyncing ? 'Sync in progress' : ''}
            >
              <History className="w-3 h-3" />
              Search Gmail History
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {activeView === "drafts" ? (
              <div className="p-3">
                <DraftsList
                  onOpenDraft={(draft) => {
                    setComposerDraftId(draft.id);
                    setComposerThreadId(draft.threadId);
                    setComposerMode(draft.threadId ? "reply" : "new");
                    setComposerOpen(true);
                  }}
                />
              </div>
            ) : threadsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader className="w-5 h-5 animate-spin text-[#FAE008]" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center p-4">
                <div>
                  <Mail className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
                  <p className="text-[13px] text-[#6B7280]">No threads</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  {filteredThreads.map((thread) => (
                    <ThreadRow
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThreadId === thread.id}
                      onClick={() => !selectionMode && setSelectedThreadId(thread.id)}
                      currentUser={user}
                      onThreadUpdate={() => refetchThreads()}
                      selectionMode={selectionMode}
                      isSelectedForBulk={selectedThreadIds.has(thread.id)}
                      onBulkSelect={handleBulkSelect}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="p-3 border-t border-[#E5E7EB]">
                    <Button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      variant="outline"
                      className="w-full text-xs"
                    >
                      {isLoadingMore ? (
                        <><Loader className="w-3 h-3 mr-2 animate-spin" />Loading...</>
                      ) : (
                        "Load More Emails"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right pane */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFB]">
          {selectedThread ? (
            <>
              <ThreadHeader
                thread={selectedThread}
                users={teamUsers}
                onStatusChange={handleStatusChange}
                onAssignChange={handleAssignChange}
                currentUser={user}
                onThreadUpdate={() => refetchThreads()}
                hasMessages={selectedThread?.message_count > 0}
                onReply={() => {
                  setComposerMode('reply');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onReplyAll={() => {
                  setComposerMode('reply_all');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onForward={() => {
                  setComposerMode('forward');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onAttach={() => {
                  setComposerMode(selectedThread?.message_count > 0 ? 'reply' : 'new');
                  setComposerThreadId(selectedThread?.message_count > 0 ? selectedThread.id : null);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
              />

              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                  <EmailDetailView
                    thread={selectedThread}
                    userPermissions={{
                      can_reply: true,
                      can_change_status: true,
                      can_link_to_project: true,
                      can_create_project_from_email: true,
                      can_create_job_from_email: true,
                    }}
                    onClose={() => setSelectedThreadId(null)}
                    onCreateProject={(msg) => {
                      setSelectedMessageForProject(msg);
                      setShowCreateProjectModal(true);
                    }}
                    onLinkProject={() => setShowLinkModal(true)}
                    onUnlinkProject={async () => {
                                       try {
                                         // DEFENSIVE: Clear both project and contract links on unlink
                                         await base44.entities.EmailThread.update(selectedThread.id, { 
                                           project_id: null,
                                           project_number: null,
                                           project_title: null,
                                           linked_to_project_at: null,
                                           linked_to_project_by: null,
                                           // Defensive clear of contract fields
                                           contract_id: null,
                                           contract_name: null,
                                           contract_status: null,
                                           contract_type: null
                                         });
                                         await refetchThreads();
                                         toast.success("Thread unlinked from project");
                                       } catch {
                                         toast.error("Failed to unlink thread");
                                       }
                                     }}
                                     onDelete={async (threadId) => {
                      try {
                        await base44.entities.EmailThread.update(threadId, { is_deleted: true });
                        await refetchThreads();
                        setSelectedThreadId(null);
                        toast.success("Thread deleted");
                      } catch {
                        toast.error("Failed to delete thread");
                      }
                    }}
                    onThreadUpdate={() => queryClient.invalidateQueries({ queryKey: inboxKeys.threads() })}
                  />


                </div>


              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-[14px] text-[#6B7280]">Select a thread to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create project from email modal */}
      {selectedThread && (
        <CreateProjectFromEmailModal
          open={showCreateProjectModal}
          onClose={() => {
            setShowCreateProjectModal(false);
            setSelectedMessageForProject(null);
          }}
          thread={selectedThread}
          emailMessage={selectedMessageForProject}
          onSuccess={(projectId) => {
            refetchThreads();
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
        />
      )}

      {/* Link thread modal */}
      {selectedThread && (
        <LinkThreadModal
          open={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onLinkProject={(projectId) => linkThreadMutation.mutate({ projectId })}
          onLinkContract={(contractId) => linkContractMutation.mutate({ contractId })}
        />
      )}

      {/* Bulk link modal */}
      <LinkThreadModal
        open={showBulkLinkModal}
        onClose={() => setShowBulkLinkModal(false)}
        onLinkProject={(projectId) => bulkLinkMutation.mutate({ projectId, linkType: 'project', count: selectedThreadIds.size })}
        onLinkContract={(contractId) => bulkLinkMutation.mutate({ contractId, linkType: 'contract', count: selectedThreadIds.size })}
      />

      {/* Gmail history search */}
      <GmailHistorySearchModal open={showHistorySearch} onOpenChange={setShowHistorySearch} mode="inbox" />

      {/* Unified composer drawer */}
      <UnifiedEmailComposer
        variant="drawer"
        open={composerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setComposerLastMessage(null);
            setComposerDraftId(null);
            setComposerMode("new");
            setComposerThreadId(null);
          }
          setComposerOpen(open);
        }}
        mode={composerMode}
        thread={selectedThread}
        message={composerLastMessage}
        existingDraft={composerDraftId ? { id: composerDraftId } : null}
        onClose={() => {
          setComposerOpen(false);
          refetchDrafts();
        }}
        onSent={() => {
          queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
          queryClient.invalidateQueries({ queryKey: inboxKeys.drafts() });
          refetchThreads();
          refetchDrafts();
        }}
      />

      {/* Warning for unsync'd threads */}
      {selectedThread && selectedThreadId && !selectedThread?.message_count && selectedThread?.gmail_thread_id && (
        <div className="fixed bottom-4 right-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs max-w-xs">
          <p className="text-amber-900 font-medium mb-1">Messages not synced yet</p>
          <p className="text-amber-800 mb-2">You can reply or forward using thread headers.</p>
          <button
            onClick={() => syncGmailInbox()}
            disabled={isSyncing}
            className="text-amber-700 hover:text-amber-900 font-medium text-xs underline"
          >
            {isSyncing ? 'Syncing...' : 'Sync this thread'}
          </button>
        </div>
      )}
    </div>
  );
}