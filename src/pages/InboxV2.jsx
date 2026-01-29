import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
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
  Sparkles,
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
import { isInboxV2Allowed } from "@/components/utils/allowlist";
import { createPageUrl } from "@/utils";
import InboxV2ContextPanel from "@/components/inboxV2/ContextPanel";

/* -------------------------
   Direction helpers (match Inbox.jsx)
--------------------------- */
const normalizeEmail = (e) => (e || "").toLowerCase().trim();

const safeTs = (iso) => {
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

const matchesAny = (text, patterns) => {
  const s = String(text || "");
  return patterns.some((r) => r.test(s));
};

const getThreadText = (thread) => {
  const subject = thread?.subject || "";
  const snippet = thread?.snippet || thread?.preview || thread?.body_preview || "";
  const combined = `${subject}\n${snippet}`;
  return { subject, snippet, combined };
};

const IMPORTANT_FYI_SUBJECT_PATTERNS = [
  /order confirmation/i,
  /\bpurchase order\b/i,
  /\bpo\b/i,
  /invoice/i,
  /tax invoice/i,
  /receipt/i,
  /payment (received|successful|confirmation)/i,
  /dispatch(ed)?/i,
  /shipping/i,
  /tracking/i,
  /delivery (update|scheduled|eta)/i,
  /\beta\b/i,
  /\bbackorder(ed)?\b/i,
  /\bready for pickup\b/i,
  /\bready for collection\b/i,
];

const LOW_VALUE_FYI_SNIPPET_PATTERNS = [
  /\ball paid\b/i,
  /\bpaid in full\b/i,
  /\bpayment done\b/i,
  /\bpayment sent\b/i,
  /\bthanks\b/i,
  /\bthank you\b/i,
  /\bcheers\b/i,
  /\bno worries\b/i,
  /\ball good\b/i,
  /\bokay\b/i,
  /\bok\b/i,
  /\bperfect\b/i,
  /\bgreat\b/i,
  /\blooks good\b/i,
  /\bconfirmed\b/i,
  /\bapproved\b/i,
];

const ACTIONABLE_PATTERNS = [
  /\?/,
  /\bcan you\b/i,
  /\bcould you\b/i,
  /\bplease\b/i,
  /\burgent\b/i,
  /\basap\b/i,
  /\bcall me\b/i,
  /\bwhen\b/i,
  /\bhow\b/i,
  /\bquote\b/i,
  /\bprice\b/i,
  /\bcost\b/i,
  /\bschedule\b/i,
  /\bbooking\b/i,
  /\binstall\b/i,
  /\brepair\b/i,
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bnot working\b/i,
  /\bbroken\b/i,
  /\bleak\b/i,
  /\brefund\b/i,
  /\bwarranty\b/i,
  /\bcomplaint\b/i,
  /\bchange\b/i,
  /\bupdate\b/i,
  /\bcancel\b/i,
  /\breschedule\b/i,
];

/* Category definitions & patterns */
const CATEGORIES = [
  { value: "uncategorised", label: "Uncategorised" },
  { value: "supplier_quote", label: "Supplier Quote" },
  { value: "supplier_invoice", label: "Supplier Invoice" },
  { value: "payment", label: "Payment / Receipt" },
  { value: "booking", label: "Booking / Scheduling" },
  { value: "client_query", label: "Client Query" },
  { value: "order_confirmation", label: "Order / Confirmation" },
];

const CATEGORY_PATTERNS = {
  supplier_invoice: [
    /\btax invoice\b/i,
    /\binvoice\b/i,
    /\bstatement\b/i,
    /\bamount due\b/i,
    /\bpayable\b/i,
    /\bremit(tance)?\b/i,
    /\bpro[- ]?forma\b/i,
  ],
  supplier_quote: [
    /\bquote\b/i,
    /\bquotation\b/i,
    /\bpricing\b/i,
    /\bestimate\b/i,
    /\bprice\b/i,
  ],
  payment: [
    /\bpayment received\b/i,
    /\bpaid\b/i,
    /\bpaid in full\b/i,
    /\breceipt\b/i,
    /\bdeposit\b/i,
    /\bremittance\b/i,
    /\btransfer\b/i,
  ],
  booking: [
    /\bbooking\b/i,
    /\bschedule\b/i,
    /\bappointment\b/i,
    /\bsite visit\b/i,
    /\binstall\b/i,
    /\breschedule\b/i,
    /\bconfirm (a )?time\b/i,
    /\bwhat time\b/i,
    /\bdate\b/i,
    /\bavailability\b/i,
  ],
  order_confirmation: [
    /\border confirmation\b/i,
    /\bpurchase order\b/i,
    /\bpo\b/i,
    /\border (has been )?(placed|confirmed)\b/i,
    /\bdispatch(ed)?\b/i,
    /\btracking\b/i,
    /\bready for pickup\b/i,
    /\bcollection\b/i,
    /\bdelivery\b/i,
    /\beta\b/i,
    /\bback[- ]?order(ed)?\b/i,
  ],
  client_query: [
    /\?/,
    /\bcan you\b/i,
    /\bcould you\b/i,
    /\bplease\b/i,
    /\bhow\b/i,
    /\bwhen\b/i,
    /\bwhy\b/i,
    /\bissue\b/i,
    /\bproblem\b/i,
    /\bnot working\b/i,
    /\bbroken\b/i,
    /\bwarranty\b/i,
    /\bchange\b/i,
    /\bupdate\b/i,
    /\bcancel\b/i,
  ],
};

function suggestCategory(thread) {
  const text = thread?.subject || "";
  const snippet = thread?.snippet || thread?.preview || thread?.body_preview || "";
  const combined = `${text}\n${snippet}`;

  const scores = [];

  function addScore(value, score, reason) {
    scores.push({ value, score, reason });
  }

  // Strong signals from subject
  if (matchesAny(text, CATEGORY_PATTERNS.order_confirmation)) addScore("order_confirmation", 90, "subject looks like order/confirmation");
  if (matchesAny(text, CATEGORY_PATTERNS.supplier_invoice)) addScore("supplier_invoice", 85, "subject looks like invoice");
  if (matchesAny(text, CATEGORY_PATTERNS.supplier_quote)) addScore("supplier_quote", 75, "subject looks like quote");

  // Medium signals from combined text
  if (matchesAny(combined, CATEGORY_PATTERNS.order_confirmation)) addScore("order_confirmation", 60, "content mentions dispatch/ETA/tracking");
  if (matchesAny(combined, CATEGORY_PATTERNS.supplier_invoice)) addScore("supplier_invoice", 55, "content mentions invoice/payment terms");
  if (matchesAny(combined, CATEGORY_PATTERNS.payment)) addScore("payment", 50, "content mentions payment/receipt");
  if (matchesAny(combined, CATEGORY_PATTERNS.booking)) addScore("booking", 45, "content mentions booking/scheduling");
  if (matchesAny(combined, CATEGORY_PATTERNS.client_query)) addScore("client_query", 40, "question/request detected");

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best) return { value: "uncategorised", reason: "no strong match", confidence: 0 };
  if (best.score < 45) return { value: "uncategorised", reason: "low confidence", confidence: best.score };

  return { value: best.value, reason: best.reason, confidence: best.score };
}

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

const classifyReceivedIntent = (thread) => {
  const { subject, snippet, combined } = getThreadText(thread);

  if (matchesAny(combined, ACTIONABLE_PATTERNS)) {
    return { bucket: "needs_reply", reason: "actionable-pattern" };
  }

  if (
    matchesAny(subject, IMPORTANT_FYI_SUBJECT_PATTERNS) ||
    matchesAny(combined, IMPORTANT_FYI_SUBJECT_PATTERNS)
  ) {
    return { bucket: "important_fyi", reason: "important-fyi" };
  }

  const shortSnippet = String(snippet || "").trim();
  const isShort = shortSnippet.length > 0 && shortSnippet.length <= 60;

  if (isShort && matchesAny(shortSnippet, LOW_VALUE_FYI_SNIPPET_PATTERNS)) {
    return { bucket: "reference", reason: "low-value-fyi" };
  }

  return { bucket: "needs_reply", reason: "received-default" };
};

// Canonical status derivation from explicit workflow fields
const deriveCanonicalStatus = (thread) => {
  if (thread?.userStatus === "closed") return "done";
  return thread?.next_action_status || "needs_action";
};

// Legacy: for display/debug only
const deriveTriageState = (thread, orgEmails = []) => {
  if (thread?.userStatus === "closed") {
    return { triage: "closed", reason: "closed", dir: "unknown" };
  }

  const linked = !!thread?.project_id || !!thread?.contract_id;
  if (!linked) {
    return { triage: "needs_link", reason: "unlinked", dir: "unknown" };
  }

  const dir = inferThreadDirection(thread, orgEmails);

  if (dir === "received") {
    const intent = classifyReceivedIntent(thread);
    return { triage: intent.bucket, reason: intent.reason, dir };
  }

  if (dir === "sent") {
    return { triage: "waiting", reason: "sent-last", dir };
  }

  return { triage: "reference", reason: "unknown-direction", dir };
};

export default function InboxV2() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  const syncInFlightRef = useRef(false);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastThreadFetchTime, setLastThreadFetchTime] = useState(0);
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [activeView, setActiveView] = useState("threads");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraftId, setComposerDraftId] = useState(null);
  const [composerThreadId, setComposerThreadId] = useState(null);
  const [composerMode, setComposerMode] = useState("new");
  const [composerLastMessage, setComposerLastMessage] = useState(null);
  const [workflowView, setWorkflowView] = useState("unassigned"); // unassigned / my-actions / waiting / fyi / done
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState(new Set());
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedMessageForProject, setSelectedMessageForProject] = useState(null);
  const [composingUsers, setComposingUsers] = useState({}); // { threadId: { userId, userName, timestamp } }
  const [detailTab, setDetailTab] = useState("messages"); // messages | notes
  const [noteInput, setNoteInput] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [updatingThreadId, setUpdatingThreadId] = useState(null);
  const [contextOpen, setContextOpen] = useState(false);

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

  // Cleanup on unmount to avoid setState warnings and reset sync lock
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      syncInFlightRef.current = false;
    };
  }, []);

  // Handle threadId from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("threadId");
    if (threadId && threadId !== selectedThreadId) {
      setSelectedThreadId(threadId);
    }
    }, []);

    // Per-session thread open deduplication (30 min window)
    const threadOpenAuditMapRef = useRef({});

  const { data: initialThreads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: inboxKeys.threads(),
    queryFn: async () => {
      devLog(`[InboxV2] queryFn STARTED - user=${user?.email}`);
      setLastThreadFetchTime(Date.now());
      devLog('[InboxV2] Fetch threads via backend function');
      try {
        const response = await base44.functions.invoke("getMyEmailThreads", { limit: 100 });
        const fetchedThreads = response.data?.threads || [];

        const result = fetchedThreads
          .filter((t) => !t.is_deleted)
          .map((thread) => ({
            ...thread,
            viewers: [],
          }));

        devLog(`[InboxV2] queryFn RETURNING ${result.length} threads`);
        return result;
      } catch (error) {
        console.error(`[InboxV2] Backend error - status: ${error.response?.status}, message: ${error.message}`);
        
        if (error.response?.status === 403) {
          toast.error("Inbox is admin/manager only (permission).");
        } else {
          toast.error("Inbox failed to load (backend error).");
        }
        
        devLog(`[InboxV2] Error fetching threads:`, error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    ...QUERY_CONFIG.reference,
    onSuccess: (newThreads) => {
      devLog(`[InboxV2] onSuccess - newThreads.length=${newThreads.length}`);
      setCursor(newThreads.length > 0 ? newThreads[newThreads.length - 1].last_message_date : null);
      setHasMore(newThreads.length === 100);
      // Always fallback to first thread if selected is missing
      if (!newThreads.find((t) => t.id === selectedThreadId)) {
        setSelectedThreadId(newThreads[0]?.id ?? null);
      }
    },
  });

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const response = await base44.functions.invoke("getMyEmailThreadsPaged", { 
        limit: 100, 
        beforeDate: cursor 
      });
      const moreThreads = response?.threads ?? response?.data?.threads ?? [];

      if (moreThreads.length > 0) {
        // Append to existing threads instead of refetching
        queryClient.setQueryData(inboxKeys.threads(), (old) => [...(old || []), ...moreThreads]);
        setCursor(response?.nextBeforeDate ?? response?.data?.nextBeforeDate ?? null);
        setHasMore(response?.hasMore ?? response?.data?.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      devLog('Failed to load more threads:', error);
      toast.error("Failed to load more threads");
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
      devLog('[InboxV2] Sync already in flight');
      return;
    }

    // Check local state
    if (isSyncing) {
      devLog('[InboxV2] Sync already in progress locally');
      return;
    }

    const now = Date.now();
    // Throttle: do not sync more frequently than every 60 seconds
    if (lastSyncTime && now - new Date(lastSyncTime).getTime() < 60000) {
      devLog(`[InboxV2] Sync throttled: last sync ${Math.round((now - new Date(lastSyncTime).getTime()) / 1000)}s ago`);
      return;
    }

    // Set sync in progress
    syncInFlightRef.current = true;
    try {
      if (mountedRef.current) setIsSyncing(true);
      
      const result = await base44.functions.invoke("gmailSyncOrchestrated", {});

      // Handle sync lock (already in progress on backend)
      if (result?.skipped && result?.reason === 'locked') {
        devLog(`[InboxV2] Sync already running, locked until ${result.locked_until}`);
        if (mountedRef.current) toast.info("Sync already running. Please wait and try again.", { duration: 3000 });
        return;
      }

      if (result?.summary) {
        devLog(
                   `[InboxV2] Sync complete: ${result.summary.threads_synced} threads, ${result.summary.messages_synced} messages`
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
    queryFn: async () => {
      const normalize = (users = []) =>
        (users || [])
          .filter(u => u?.email)
          .map(u => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name || u.full_name || u.email,
            full_name: u.full_name,
            aliases: u.aliases || [],
            org_emails: u.org_emails || []
          }));

      const fallbackSelf = () => {
        if (!user?.email) return [];
        return [{ email: user.email, display_name: user.display_name || user.full_name || user.email }];
      };

      try {
        // 1) Preferred
        const r1 = await base44.functions.invoke("getTeamUsers", {});
        const u1 = normalize(r1?.users ?? r1?.data?.users ?? []);
        if (u1.length > 0) return u1;

        // 2) Fallback
        const r2 = await base44.functions.invoke("getAllUsers", {});
        const u2 = normalize(r2?.users ?? r2?.data?.users ?? []);
        if (u2.length > 0) return u2;

        // 3) Last resort
        return fallbackSelf();
      } catch (e1) {
        try {
          const r2 = await base44.functions.invoke("getAllUsers", {});
          const u2 = normalize(r2?.users ?? r2?.data?.users ?? []);
          if (u2.length > 0) return u2;
          return fallbackSelf();
        } catch (e2) {
          return fallbackSelf();
        }
      }
    },
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

  // Fetch thread notes
  const { data: threadNotes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["threadNotes", selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return [];
      return base44.entities.EmailThreadNote.filter(
        { thread_id: selectedThreadId },
        "-created_date"
      );
    },
    enabled: !!selectedThreadId,
    ...QUERY_CONFIG.reference,
  });

  // Canonical status: workflow field with fallback
  const deriveCanonicalStatus = (thread) => {
    if (thread?.userStatus === "closed") return "done";
    return thread?.next_action_status || "needs_action";
  };

  // Derive workflow state for all threads
  const derivedThreads = useMemo(() => {
    return (threads || [])
      .filter((t) => !t.is_deleted)
      .map((t) => {
        const status = deriveCanonicalStatus(t);
        return {
          ...t,
          _status: status, // canonical: needs_action / waiting / fyi / done
        };
      });
  }, [threads]);

  // Count workflow status
  const workflowCounts = useMemo(() => {
    const counts = {
      unassigned: 0,
      my_actions: 0,
      waiting: 0,
      fyi: 0,
      done: 0,
    };
    derivedThreads.forEach((t) => {
      if (t._status === "done") {
        counts.done++;
      } else if (t._status === "waiting") {
        counts.waiting++;
      } else if (t._status === "fyi") {
        counts.fyi++;
      } else if (t._status === "needs_action") {
        if (!t.assigned_to) {
          counts.unassigned++;
        } else if (t.assigned_to === user?.email) {
          counts.my_actions++;
        }
      }
    });
    return counts;
  }, [derivedThreads, user?.email]);

  // Apply workflow view filter + text search with proper sorting
  const filteredThreads = useMemo(() => {
    let result = derivedThreads;

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

    // Apply workflow view filter
    if (workflowView === "unassigned") {
      result = result.filter((t) => t._status === "needs_action" && !t.assigned_to);
    } else if (workflowView === "my-actions") {
      result = result.filter((t) => t._status === "needs_action" && t.assigned_to === user?.email);
    } else if (workflowView === "waiting") {
      result = result.filter((t) => t._status === "waiting");
    } else if (workflowView === "fyi") {
      result = result.filter((t) => t._status === "fyi");
    } else if (workflowView === "done") {
      result = result.filter((t) => t._status === "done");
    }

    // Sorting per view
    if (workflowView === "unassigned" || workflowView === "my-actions") {
      // Newest last_message_date first
      result.sort((a, b) => {
        const ta = safeTs(a.last_message_date);
        const tb = safeTs(b.last_message_date);
        return tb - ta;
      });
    } else if (workflowView === "waiting") {
      // Oldest last_message_date first (stalled items surface)
      result.sort((a, b) => {
        const ta = safeTs(a.last_message_date);
        const tb = safeTs(b.last_message_date);
        return ta - tb;
      });
    } else {
      // FYI / Done: newest first
      result.sort((a, b) => {
        const ta = safeTs(a.last_message_date);
        const tb = safeTs(b.last_message_date);
        return tb - ta;
      });
    }

    return result;
  }, [derivedThreads, searchTerm, user?.email, workflowView]);

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
      const assignedUser = userEmail ? teamUsers.find((u) => u.email === userEmail) : null;
      
      // Use backend function for assignment (handles audit trail)
      await base44.functions.invoke("assignEmailThread", {
        thread_id: selectedThread.id,
        assigned_to_user_email: userEmail || null,
      });
      
      // Invalidate threads to refresh workflow state
      await refetchThreads();
      
      if (userEmail) {
        toast.success(`Assigned to ${assignedUser?.full_name || userEmail}`);
      } else {
        toast.success("Unassigned");
      }
    } catch (error) {
      devLog("Failed to assign thread:", error);
      toast.error("Failed to assign thread");
    }
  };

  // Track thread view + audit opened
  useEffect(() => {
    if (!selectedThread || !user) return;

    const timeout = setTimeout(() => {
      // Update viewer last seen
      base44.functions.invoke('updateEmailThreadViewerLastSeen', {
        thread_id: selectedThread.id,
      }).catch(() => {});

      // Log "opened by" audit (de-duped: once per 30 min per thread per user)
      const mapKey = selectedThread.id;
      const now = Date.now();
      const lastAudit = threadOpenAuditMapRef.current[mapKey];

      if (!lastAudit || now - lastAudit > 30 * 60 * 1000) {
        threadOpenAuditMapRef.current[mapKey] = now;

        base44.entities.EmailAudit?.create?.({
          thread_id: selectedThread.id,
          type: 'thread_opened',
          message: `Opened by ${user.display_name || user.full_name || user.email}`,
          actor_user_id: user.id,
          actor_name: user.display_name || user.full_name || user.email,
        }).catch(() => {});
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [selectedThread?.id, user?.email, user?.id, user?.display_name, user?.full_name]);

  // Cleanup composing status when thread is closed or component unmounts
  useEffect(() => {
    return () => {
      // Clear composing status on unmount
      setComposingUsers({});
    };
  }, []);

  // Auto-close context drawer when selected thread changes on small screens
  useEffect(() => {
    setContextOpen(false);
  }, [selectedThreadId]);

  // Composer sent
  const handleComposerSent = async () => {
    // Clear composing status for current thread
    if (composerThreadId) {
      setComposingUsers((prev) => {
        const next = { ...prev };
        delete next[composerThreadId];
        return next;
      });
    }
    
    await refetchThreads();
    await refetchDrafts();
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: inboxKeys.thread(selectedThread.id) });
    }
  };

  // Track composing state
  const handleComposerOpen = (threadId) => {
    if (threadId && user) {
      setComposingUsers((prev) => ({
        ...prev,
        [threadId]: {
          userId: user.id,
          userName: user.display_name || user.full_name || user.email,
          timestamp: Date.now(),
        },
      }));
    }
  };

  const handleComposerClose = (threadId) => {
    if (threadId) {
      setComposingUsers((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
    }
  };

  const handleTakeoverReply = async (threadId) => {
    if (!threadId || !user) return;
    
    try {
      // Mark current user as composing (takeover)
      setComposingUsers((prev) => ({
        ...prev,
        [threadId]: {
          userId: user.id,
          userName: user.display_name || user.full_name || user.email,
          timestamp: Date.now(),
        },
      }));
      
      // Open composer in reply mode
      setComposerMode("reply");
      setComposerThreadId(threadId);
      setComposerLastMessage(null);
      setComposerDraftId(null);
      setComposerOpen(true);
      
      toast.success("You're now composing the reply");
    } catch (error) {
      devLog("Failed to takeover reply:", error);
      toast.error("Failed to takeover reply");
    }
  };

  // Add team note
  const handleAddNote = async () => {
    if (!selectedThread || !noteInput.trim() || !user) return;
    
    setIsAddingNote(true);
    try {
      await base44.entities.EmailThreadNote.create({
        thread_id: selectedThread.id,
        body: noteInput.trim(),
        author_email: user.email,
        author_name: user.display_name || user.full_name || user.email,
      });
      
      setNoteInput("");
      await refetchNotes();
      toast.success("Note added");
    } catch (error) {
      devLog("Failed to add note:", error);
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  // Convert thread to task
  const handleConvertToTask = async () => {
    if (!selectedThread || !user) return;
    
    try {
      const participants = [
        selectedThread.from_address,
        ...(selectedThread.to_addresses || []),
      ]
        .filter(Boolean)
        .join(", ");
      
      const snippet = selectedThread.last_message_snippet || selectedThread.snippet || "";
      const threadLink = `${window.location.origin}${createPageUrl("Inbox")}?threadId=${selectedThread.id}`;
      
      const taskDescription = `
Thread: ${selectedThread.subject}

Participants: ${participants}

Last message: ${snippet.substring(0, 200)}${snippet.length > 200 ? "..." : ""}

Link: ${threadLink}
      `.trim();
      
      const task = await base44.entities.Task.create({
        title: `[Email] ${selectedThread.subject}`,
        description: taskDescription,
        project_id: selectedThread.project_id || undefined,
        status: "todo",
        priority: "medium",
        created_by: user.email,
      });
      
      toast.success("Task created");
    } catch (error) {
      devLog("Failed to convert to task:", error);
      toast.error("Failed to create task");
    }
  };

  // Workflow status updates
  const handleWorkflowStatusChange = async (newStatus) => {
    if (!selectedThread) return;
    
    setUpdatingThreadId(selectedThread.id);
    try {
      await base44.entities.EmailThread.update(selectedThread.id, {
        next_action_status: newStatus,
      });
      await refetchThreads();
      toast.success(`Status changed to ${newStatus === 'needs_action' ? 'Needs Action' : newStatus === 'waiting' ? 'Waiting' : 'FYI'}`);
    } catch (error) {
      devLog("Failed to update status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingThreadId(null);
    }
  };

  const handleMarkDone = async () => {
    if (!selectedThread) return;
    
    setUpdatingThreadId(selectedThread.id);
    try {
      await base44.entities.EmailThread.update(selectedThread.id, {
        userStatus: "closed",
      });
      await refetchThreads();
      toast.success("Marked as Done");
    } catch (error) {
      devLog("Failed to mark done:", error);
      toast.error("Failed to mark as done");
    } finally {
      setUpdatingThreadId(null);
    }
  };

  const handleReopen = async () => {
    if (!selectedThread) return;
    
    setUpdatingThreadId(selectedThread.id);
    try {
      await base44.entities.EmailThread.update(selectedThread.id, {
        userStatus: null,
        next_action_status: "needs_action",
      });
      await refetchThreads();
      toast.success("Reopened");
    } catch (error) {
      devLog("Failed to reopen:", error);
      toast.error("Failed to reopen");
    } finally {
      setUpdatingThreadId(null);
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
    const ids = Array.from(selectedThreadIds);
    const BATCH_SIZE = 10;
    
    try {
      const now = new Date().toISOString();
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((id) =>
            base44.entities.EmailThread.update(id, {
              isUnread: false,
              lastReadAt: now,
              unreadUpdatedAt: now,
            })
          )
        );
        
        // Small delay between batches
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Marked ${count} thread${count !== 1 ? "s" : ""} as read`);
    } catch {
      toast.error("Failed to mark threads as read");
    }
  };

  const bulkMarkAsUnread = async () => {
    const count = selectedThreadIds.size;
    const ids = Array.from(selectedThreadIds);
    const BATCH_SIZE = 10;
    
    try {
      const now = new Date().toISOString();
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((id) =>
            base44.entities.EmailThread.update(id, {
              isUnread: true,
              unreadUpdatedAt: now,
            })
          )
        );
        
        // Small delay between batches
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Marked ${count} thread${count !== 1 ? "s" : ""} as unread`);
    } catch {
      toast.error("Failed to mark threads as unread");
    }
  };

  const bulkClose = async () => {
    const count = selectedThreadIds.size;
    const ids = Array.from(selectedThreadIds);
    const BATCH_SIZE = 10;
    
    try {
      // Process in batches to avoid rate limits
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((id) => base44.entities.EmailThread.update(id, { userStatus: "closed" }))
        );
        
        // Small delay between batches
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await refetchThreads();
      setSelectedThreadIds(new Set());
      toast.success(`Closed ${count} thread${count !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to close threads");
    }
  };

  const bulkAssignToMe = async () => {
    const count = selectedThreadIds.size;
    const ids = Array.from(selectedThreadIds);
    const BATCH_SIZE = 10;
    
    try {
      const now = new Date().toISOString();
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((id) =>
            base44.entities.EmailThread.update(id, {
              assigned_to: user.email,
              assigned_to_name: user.display_name || user.full_name,
              assigned_by: user.email,
              assigned_by_name: user.display_name || user.full_name,
              assigned_at: now,
            })
          )
        );
        
        // Small delay between batches
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
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

  // Allowlist gate + loading check
  if (!isInboxV2Allowed(user) || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        {!user ? (
          <Loader className="w-5 h-5 animate-spin text-[#FAE008]" />
        ) : (
          <div className="text-center">
            <Mail className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[14px] text-[#6B7280]">Access denied</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Testing Header */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-4">
        <Link
          to="/Inbox"
          className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
        >
          Go to current Inbox
        </Link>
        <span className="text-sm font-medium text-blue-900">You are in Inbox V2</span>
      </div>

      {/* Inbox V2 Banner */}
      <div className="bg-purple-50 border-b border-purple-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-purple-900">Inbox V2 (Workflow Queue)</p>
          <p className="text-xs text-purple-800">
            Unassigned: {workflowCounts.unassigned} | My Actions: {workflowCounts.my_actions} | Waiting: {workflowCounts.waiting} | FYI: {workflowCounts.fyi} | Done: {workflowCounts.done}
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* Left pane: Queue */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-[#E5E7EB] overflow-hidden">
          {/* Bulk toolbar */}
          {selectionMode && selectedThreadIds.size > 0 && activeView === "threads" && (
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
                setActiveView("threads");
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedThreadIds(new Set());
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === "threads" ? "bg-[#FAE008] text-[#111827]" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
            >
              Threads
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
          {selectionMode && activeView === "threads" && (
            <div className="px-3 py-2 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" onClick={selectAllThreads} className="text-xs">
                Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAllThreads} className="text-xs">
                Deselect All
              </Button>
            </div>
          )}

          {/* Workflow view tabs */}
          {activeView === "threads" && !selectionMode && (
            <div className="px-3 py-2 border-b border-[#E5E7EB] flex gap-1 flex-wrap">
              {[
                { key: 'unassigned', label: 'Unassigned' },
                { key: 'my-actions', label: 'My Actions' },
                { key: 'waiting', label: 'Waiting' },
                { key: 'fyi', label: 'FYI' },
                { key: 'done', label: 'Done' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setWorkflowView(tab.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    workflowView === tab.key
                      ? 'bg-[#FAE008] text-[#111827]'
                      : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {tab.label} ({workflowCounts[tab.key] || 0})
                </button>
              ))}
            </div>
          )}

          {/* Filter bar */}
          {activeView === "threads" && !selectionMode && (
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
            {activeView === "threads" && (
              <>
                {threadsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader className="w-5 h-5 animate-spin text-[#FAE008]" />
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center p-4">
                    <div>
                      <Mail className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
                      <p className="text-[13px] text-[#6B7280]">No threads in this view</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto">
                      {filteredThreads.map((thread) => (
                        <div key={thread.id} className="border-b border-[#E5E7EB] last:border-b-0">
                          <ThreadRow
                            thread={thread}
                            isSelected={selectedThreadId === thread.id}
                            onClick={() => !selectionMode && setSelectedThreadId(thread.id)}
                            currentUser={user}
                            onThreadUpdate={() => refetchThreads()}
                            selectionMode={selectionMode}
                            isSelectedForBulk={selectedThreadIds.has(thread.id)}
                            onBulkSelect={handleBulkSelect}
                          />
                          {/* Workflow status hint */}
                          <div className="px-3 py-1 bg-[#F9FAFB] flex items-center gap-2 text-xs text-[#6B7280]">
                            <span className="font-medium text-[#4B5563]">{thread._status === 'needs_action' ? 'Needs Action' : thread._status === 'waiting' ? 'Waiting' : thread._status === 'fyi' ? 'FYI' : 'Done'}</span>
                            <span>·</span>
                            <span>{thread.assigned_to ? `Owner: ${thread.assigned_to_name || thread.assigned_to}` : 'Unassigned'}</span>
                          </div>
                        </div>
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
              </>
            )}
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
            ) : null}
          </div>
        </div>

        {/* Middle pane: Thread Detail */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#F9FAFB] border-r border-[#E5E7EB]">
          {selectedThread ? (
            <>
              {/* Composing presence banner */}
              {composingUsers[selectedThread.id] && composingUsers[selectedThread.id].userId !== user?.id && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-amber-900">
                      {composingUsers[selectedThread.id].userName} is replying…
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTakeoverReply(selectedThread.id)}
                    className="h-7 text-xs border-amber-200 hover:bg-amber-100"
                  >
                    Take over reply
                  </Button>
                </div>
              )}

              <div className="bg-white border-b border-[#E5E7EB] p-3 space-y-2">
                {/* Workflow status controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedThread?.userStatus !== 'closed' && (
                    <>
                      <select
                        value={selectedThread?.next_action_status || 'needs_action'}
                        onChange={(e) => handleWorkflowStatusChange(e.target.value)}
                        disabled={updatingThreadId === selectedThread?.id}
                        className="text-xs px-2 py-1 rounded border border-[#E5E7EB] hover:border-[#D1D5DB]"
                      >
                        <option value="needs_action">Needs Action</option>
                        <option value="waiting">Waiting</option>
                        <option value="fyi">FYI</option>
                      </select>
                      <Button
                        onClick={handleMarkDone}
                        disabled={updatingThreadId === selectedThread?.id}
                        className="h-7 px-2 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        variant="outline"
                      >
                        Mark Done
                      </Button>
                    </>
                  )}
                  {selectedThread?.userStatus === 'closed' && (
                    <Button
                      onClick={handleReopen}
                      disabled={updatingThreadId === selectedThread?.id}
                      className="h-7 px-2 text-xs bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                      variant="outline"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
              <ThreadHeader
                thread={selectedThread}
                users={teamUsers}
                onStatusChange={handleWorkflowStatusChange}
                onAssignChange={handleAssignChange}
                currentUser={user}
                onThreadUpdate={() => refetchThreads()}
                hasMessages={selectedThread?.message_count > 0}
                onReply={() => {
                  handleComposerOpen(selectedThread.id);
                  setComposerMode('reply');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onReplyAll={() => {
                  handleComposerOpen(selectedThread.id);
                  setComposerMode('reply_all');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onForward={() => {
                  handleComposerOpen(selectedThread.id);
                  setComposerMode('forward');
                  setComposerThreadId(selectedThread.id);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
                onAttach={() => {
                  handleComposerOpen(selectedThread.id);
                  setComposerMode(selectedThread?.message_count > 0 ? 'reply' : 'new');
                  setComposerThreadId(selectedThread?.message_count > 0 ? selectedThread.id : null);
                  setComposerLastMessage(null);
                  setComposerDraftId(null);
                  setComposerOpen(true);
                }}
              />

              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                {/* Detail Tab Selector */}
                <div className="flex gap-2 px-4 py-2 border-b border-[#E5E7EB] bg-white items-center">
                    <button
                      onClick={() => setDetailTab("messages")}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        detailTab === "messages"
                          ? "bg-[#FAE008] text-[#111827]"
                          : "text-[#6B7280] hover:text-[#111827]"
                      }`}
                    >
                      Messages
                    </button>
                    <button
                      onClick={() => setDetailTab("notes")}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        detailTab === "notes"
                          ? "bg-[#FAE008] text-[#111827]"
                          : "text-[#6B7280] hover:text-[#111827]"
                      }`}
                    >
                      Team Notes ({threadNotes.length})
                    </button>
                    <button
                      onClick={() => setContextOpen(true)}
                      className="xl:hidden ml-auto px-3 py-1.5 rounded text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                      title="Open context panel"
                    >
                      Context
                    </button>
                  </div>

                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                  {detailTab === "messages" ? (
                    <div className="flex-1 overflow-y-auto p-4">
                      <EmailDetailView
                        thread={selectedThread}
                        onThreadUpdate={() => refetchThreads()}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto flex flex-col">
                      {/* Team Notes Panel */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {threadNotes.length === 0 ? (
                          <div className="text-center text-[#6B7280] py-8">
                            <p className="text-sm">No notes yet</p>
                          </div>
                        ) : (
                          threadNotes.map((note) => (
                            <div key={note.id} className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-[#4B5563]">{note.author_name || note.author_email}</span>
                                <span className="text-xs text-[#9CA3AF]">
                                  {new Date(note.created_date).toLocaleDateString()} {new Date(note.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-sm text-[#111827] whitespace-pre-wrap">{note.body}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Note Input */}
                      <div className="p-4 border-t border-[#E5E7EB] bg-white space-y-2">
                        <textarea
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Add a team note..."
                          className="w-full h-20 p-2 border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#111827]"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddNote}
                            disabled={!noteInput.trim() || isAddingNote}
                            className="flex-1 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] text-sm"
                          >
                            {isAddingNote ? "Adding..." : "Add Note"}
                          </Button>
                          <Button
                            onClick={handleConvertToTask}
                            variant="outline"
                            className="text-sm"
                            title="Create a task from this thread"
                          >
                            Convert to Task
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
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

        {/* Right pane: Context (Link or Project) - visible only on xl+ */}
        <div className="hidden xl:flex w-[320px] flex-shrink-0 flex flex-col border-l border-[#E5E7EB] overflow-hidden bg-white">
          <InboxV2ContextPanel
            thread={selectedThread}
            teamUsers={teamUsers}
            currentUser={user}
            onThreadUpdate={() => refetchThreads()}
            onOpenLinkModal={() => setShowLinkModal(true)}
            onOpenCreateProjectModal={() => setShowCreateProjectModal(true)}
          />
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
            handleComposerClose(composerThreadId);
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
          handleComposerClose(composerThreadId);
          setComposerOpen(false);
          refetchDrafts();
        }}
        onSent={() => {
          handleComposerSent();
          queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
          queryClient.invalidateQueries({ queryKey: inboxKeys.drafts() });
          refetchThreads();
          refetchDrafts();
        }}
      />

      {/* Context drawer for small screens */}
      {contextOpen && selectedThread && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={() => setContextOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-[360px] bg-white border-l border-[#E5E7EB] z-50 overflow-hidden xl:hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-[#111827]">Triage</h3>
              <button
                onClick={() => setContextOpen(false)}
                className="p-1 hover:bg-[#E5E7EB] rounded transition-colors"
              >
                <XIcon className="w-4 h-4 text-[#111827]" />
              </button>
            </div>

            {/* Content */}
            <InboxV2ContextPanel
              thread={selectedThread}
              teamUsers={teamUsers}
              currentUser={user}
              onThreadUpdate={() => refetchThreads()}
              onOpenLinkModal={() => setShowLinkModal(true)}
              onOpenCreateProjectModal={() => setShowCreateProjectModal(true)}
            />
          </div>
        </>
      )}

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