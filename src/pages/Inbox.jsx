import { useState, useEffect, useMemo } from "react";
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
import SharedComposer from "@/components/inbox/SharedComposer";
import EmailDetailView from "@/components/inbox/EmailDetailView";
import LinkThreadModal from "@/components/inbox/LinkThreadModal";
import GmailHistorySearchModal from "@/components/inbox/GmailHistorySearchModal";
import DraftsList from "@/components/inbox/DraftsList";
import EmailComposerDrawer from "@/components/inbox/EmailComposerDrawer";

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
  const [user, setUser] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [showComposer, setShowComposer] = useState(false);
  const [composerMessage, setComposerMessage] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastThreadFetchTime, setLastThreadFetchTime] = useState(0);
  const [lastSyncRequestTime, setLastSyncRequestTime] = useState(0); // rate limit sync calls
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [activeView, setActiveView] = useState("inbox"); // inbox | drafts
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraftId, setComposerDraftId] = useState(null);
  const [composerThreadId, setComposerThreadId] = useState(null);
  const [composerMode, setComposerMode] = useState("new");

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState(new Set());
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
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

  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: inboxKeys.threads(),
    queryFn: async () => {
      setLastThreadFetchTime(Date.now());
      const allThreads = await base44.entities.EmailThread.list("-last_message_date", 100);
      const viewers = await base44.entities.EmailThreadViewer.list();

      return allThreads
        .filter((t) => !t.is_deleted)
        .map((thread) => ({
          ...thread,
          viewers: viewers.filter((v) => v.thread_id === thread.id),
        }));
    },
    enabled: !!user,
    ...QUERY_CONFIG.reference,
    onSuccess: (newThreads) => {
      if (selectedThreadId && !newThreads.find((t) => t.id === selectedThreadId)) {
        const currentIndex = threads.findIndex((t) => t.id === selectedThreadId);
        const nextThread = newThreads[Math.min(currentIndex, newThreads.length - 1)];
        setSelectedThreadId(nextThread?.id || null);
        console.log(
          `[Inbox] Thread selection reset: ${selectedThreadId} not found, selected ${nextThread?.id || "null"}`
        );
      }
    },
  });

  // Real-time subscription for EmailThread updates (debounced with staleTime gating)
  useEffect(() => {
    if (!user) return;

    let debounceTimer;
    const unsubscribe = base44.entities.EmailThread.subscribe(() => {
      const now = Date.now();
      if (now - lastThreadFetchTime < 30000) return; // fresh, skip

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
      }, 500);
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [user, queryClient, lastThreadFetchTime]);

  // Sync Gmail inbox + messages (orchestrated)
  const syncGmailInbox = async () => {
    if (isSyncing) return;

    const now = Date.now();
    if (now - lastSyncRequestTime < 60000) {
      console.log(`[Inbox] Sync blocked: last sync ${Math.round((now - lastSyncRequestTime) / 1000)}s ago`);
      return;
    }

    try {
      setIsSyncing(true);
      setLastSyncRequestTime(now);
      const result = await base44.functions.invoke("gmailSyncOrchestrated", {});

      if (result?.summary) {
        console.log(
          `[Inbox] Sync complete: ${result.summary.threads_synced} threads, ${result.summary.messages_synced} messages`
        );
      }

      await refetchThreads();
      setLastSyncTime(new Date());

      if (result?.errors?.length) console.warn("Sync completed with errors:", result.errors);
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync emails");
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync on mount and when tab becomes visible (with staleTime gating)
  useEffect(() => {
    if (!user) return;

    syncGmailInbox();

    let visibilityTimeout;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          const now = Date.now();
          if (now - lastThreadFetchTime >= 30000) syncGmailInbox();
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
    let result = (threads || [])
      .filter((t) => !t.is_deleted)
      .map((t) => ({
        ...t,
        inferredDirection: inferThreadDirection(t, orgEmails),
      }));

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
    }

    // Filters
    if (Object.keys(activeFilters).length === 0) {
      result = result.filter((t) => t.userStatus !== "closed");
    } else if (activeFilters["assigned-to-me"]) {
      result = result.filter((t) => t.assigned_to === user.email && t.userStatus !== "closed");
    } else if (activeFilters["sent"]) {
      result = result.filter((t) => t.inferredDirection === "sent" && t.userStatus !== "closed");
    } else if (activeFilters["received"]) {
      result = result.filter((t) => t.inferredDirection === "received" && t.userStatus !== "closed");
    } else if (activeFilters["closed"]) {
      result = result.filter((t) => t.userStatus === "closed");
    } else if (activeFilters["pinned"]) {
      result = result.filter((t) => t.pinnedAt && t.userStatus !== "closed");
    } else if (activeFilters["linked"]) {
      result = result.filter((t) => t.project_id || t.contract_id);
    } else if (activeFilters["unlinked"]) {
      result = result.filter((t) => !t.project_id && !t.contract_id && t.userStatus !== "closed");
    }

    // Sorting:
    // 1) Pinned first (newest pin first)
    // 2) Unread next
    // 3) Newest by last_message_date
    const sortFunction = (a, b) => {
      const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;

      const aTime = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
      const bTime = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
      return bTime - aTime;
    };

    return result.sort(sortFunction);
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
      base44.entities.EmailThreadViewer.filter({
        thread_id: selectedThread.id,
        user_email: user.email,
      })
        .then((existing) => {
          if (existing.length > 0) {
            base44.asServiceRole.entities.EmailThreadViewer.update(existing[0].id, {
              last_seen: new Date().toISOString(),
            }).catch(() => {});
          } else {
            base44.entities.EmailThreadViewer.create({
              thread_id: selectedThread.id,
              user_email: user.email,
              user_name: user.full_name,
              last_seen: new Date().toISOString(),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }, 10000);

    return () => clearTimeout(timeout);
  }, [selectedThread?.id, user?.email]);

  // Composer sent
  const handleComposerSent = async () => {
    setShowComposer(false);
    setComposerMessage(null);
    await refetchThreads();
    await refetchDrafts();
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: ["emailThread", selectedThread.id] });
    }
  };

  // Draft click
  const handleEditDraft = (draft) => {
    setComposerMessage({ draft });
    setShowComposer(true);
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
              className="w-full px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <History className="w-3 h-3" />
              Search Gmail History
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
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
              filteredThreads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread} // includes inferredDirection
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => !selectionMode && setSelectedThreadId(thread.id)}
                  currentUser={user}
                  onThreadUpdate={() => refetchThreads()}
                  selectionMode={selectionMode}
                  isSelectedForBulk={selectedThreadIds.has(thread.id)}
                  onBulkSelect={handleBulkSelect}
                />
              ))
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
                    onLinkProject={() => setShowLinkModal(true)}
                    onLinkJob={() => {}}
                    onUnlinkProject={async () => {
                      try {
                        await base44.entities.EmailThread.update(selectedThread.id, { project_id: null });
                        await refetchThreads();
                        toast.success("Thread unlinked from project");
                      } catch {
                        toast.error("Failed to unlink thread");
                      }
                    }}
                    onUnlinkJob={() => {}}
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

                  {/* Drafts under thread */}
                  {threadDrafts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-medium text-[#6B7280] mb-2">Drafts</div>
                      {threadDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          onClick={() => handleEditDraft(draft)}
                          className="p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-amber-800">Draft</span>
                            <span className="text-xs text-amber-600">
                              {new Date(draft.updated_date).toLocaleDateString()}
                            </span>
                          </div>
                          {draft.subject && <div className="text-sm font-medium text-[#111827] mb-1">{draft.subject}</div>}
                          <div className="text-xs text-[#6B7280] line-clamp-2">
                            {draft.body_text?.substring(0, 150) || "No content"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {showComposer && (
                  <div className="border-t border-[#E5E7EB] p-4 bg-white flex-shrink-0">
                    <SharedComposer
                      mode="reply"
                      thread={selectedThread}
                      message={composerMessage?.message}
                      existingDraft={composerMessage?.draft}
                      currentUser={user}
                      onClose={() => {
                        setShowComposer(false);
                        setComposerMessage(null);
                      }}
                      onSent={handleComposerSent}
                    />
                  </div>
                )}
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

      {/* Composer drawer */}
      <EmailComposerDrawer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        mode={composerMode}
        threadId={composerThreadId}
        existingDraftId={composerDraftId}
      />
    </div>
  );
}