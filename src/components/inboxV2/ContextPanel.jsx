import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/components/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LinkIcon, Sparkles, Check, RotateCcw, X, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/utils';

// Minimum confidence threshold for category suggestions
const MIN_CATEGORY_CONFIDENCE = 45;

// Category definitions
const CATEGORIES = [
  { value: "uncategorised", label: "Uncategorised" },
  { value: "supplier_quote", label: "Supplier Quote" },
  { value: "supplier_invoice", label: "Supplier Invoice" },
  { value: "payment", label: "Payment / Receipt" },
  { value: "booking", label: "Booking / Scheduling" },
  { value: "client_query", label: "Client Query" },
  { value: "order_confirmation", label: "Order / Confirmation" },
];

// Helper functions
const normalizeEmail = (e) => (e || '').toLowerCase().trim();

const matchesAny = (text, patterns) => {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return false;
  const s = String(text || "");
  return patterns.some((r) => r && r.test && r.test(s));
};

function suggestCategoryInContext(thread) {
  // Extract text with fallbacks
  const subject = thread?.subject || thread?.thread_subject || thread?.last_subject || thread?.last_message_subject || "";
  const snippet = thread?.last_message_snippet || thread?.snippet || thread?.preview || thread?.body_preview || thread?.last_snippet || "";
  const combined = `${subject}\n${snippet}`;

  const scores = [];
  const patterns = {
    supplier_invoice: [
      /\btax invoice\b/i, /\binvoice\b/i, /\bstatement\b/i, /\bamount due\b/i, /\bpayable\b/i, /\bremit(tance)?\b/i, /\bpro[- ]?forma\b/i,
    ],
    supplier_quote: [
      /\bquote\b/i, /\bquotation\b/i, /\bpricing\b/i, /\bestimate\b/i, /\bprice\b/i,
    ],
    payment: [
      /\bpayment received\b/i, /\bpaid\b/i, /\bpaid in full\b/i, /\breceipt\b/i, /\bdeposit\b/i, /\bremittance\b/i, /\btransfer\b/i,
    ],
    booking: [
      /\bbooking\b/i, /\bschedule\b/i, /\bappointment\b/i, /\bsite visit\b/i, /\binstall\b/i, /\breschedule\b/i, /\bconfirm (a )?time\b/i, /\bwhat time\b/i, /\bdate\b/i, /\bavailability\b/i,
    ],
    order_confirmation: [
      /\border confirmation\b/i, /\bpurchase order\b/i, /\bpo\b/i, /\border (has been )?(placed|confirmed)\b/i, /\bdispatch(ed)?\b/i, /\btracking\b/i, /\bready for pickup\b/i, /\bcollection\b/i, /\bdelivery\b/i, /\beta\b/i, /\bback[- ]?order(ed)?\b/i,
    ],
    client_query: [
      /\?/, /\bcan you\b/i, /\bcould you\b/i, /\bplease\b/i, /\bhow\b/i, /\bwhen\b/i, /\bwhy\b/i, /\bissue\b/i, /\bproblem\b/i, /\bnot working\b/i, /\bbroken\b/i, /\bwarranty\b/i, /\bchange\b/i, /\bupdate\b/i, /\bcancel\b/i,
    ],
  };

  // Strong signals from subject (high confidence)
  if (matchesAny(subject, patterns.order_confirmation)) scores.push({ value: 'order_confirmation', score: 95, reason: 'subject matches order/confirmation' });
  if (matchesAny(subject, patterns.supplier_invoice)) scores.push({ value: 'supplier_invoice', score: 90, reason: 'subject matches invoice' });
  if (matchesAny(subject, patterns.supplier_quote)) scores.push({ value: 'supplier_quote', score: 85, reason: 'subject matches quote' });
  if (matchesAny(subject, patterns.booking)) scores.push({ value: 'booking', score: 80, reason: 'subject mentions booking/scheduling' });
  if (matchesAny(subject, patterns.payment)) scores.push({ value: 'payment', score: 75, reason: 'subject mentions payment' });
  
  // Medium signals from combined text
  if (matchesAny(combined, patterns.order_confirmation)) scores.push({ value: 'order_confirmation', score: 65, reason: 'content mentions dispatch/tracking' });
  if (matchesAny(combined, patterns.supplier_invoice)) scores.push({ value: 'supplier_invoice', score: 60, reason: 'content mentions invoice/payment terms' });
  if (matchesAny(combined, patterns.booking)) scores.push({ value: 'booking', score: 55, reason: 'content mentions booking/scheduling' });
  if (matchesAny(combined, patterns.payment)) scores.push({ value: 'payment', score: 52, reason: 'content mentions payment/receipt' });
  if (matchesAny(combined, patterns.supplier_quote)) scores.push({ value: 'supplier_quote', score: 50, reason: 'content mentions quote/pricing' });
  if (matchesAny(combined, patterns.client_query)) scores.push({ value: 'client_query', score: 45, reason: 'question/request detected' });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score < 45) return { value: 'uncategorised', reason: 'low confidence', confidence: 0 };
  return { value: best.value, reason: best.reason, confidence: best.score };
}

// Extract thread participants for matching
const getThreadParticipants = (thread) => {
  const set = new Set();
  if (thread?.from_address) set.add(normalizeEmail(thread.from_address));
  if (thread?.to_addresses) {
    (thread.to_addresses || []).forEach((addr) => {
      if (addr) set.add(normalizeEmail(addr));
    });
  }
  return Array.from(set);
};

// Score a project for thread relevance
const scoreProjectForThread = (project, thread, participants) => {
  let score = 0;

  // Customer email match
  if (project.customer_email && participants.includes(normalizeEmail(project.customer_email))) {
    score += 50;
  }

  // Project number in subject
  if (project.project_number && thread.subject) {
    const numStr = String(project.project_number);
    if (thread.subject.includes(numStr)) score += 25;
  }

  // Customer name in subject/snippet
  if (project.customer_name) {
    const combined = `${thread.subject || ''} ${thread.last_message_snippet || ''}`.toLowerCase();
    if (combined.includes(project.customer_name.toLowerCase())) score += 20;
  }

  // Recent activity
  if (project.updated_date) {
    const now = Date.now();
    const updated = new Date(project.updated_date).getTime();
    const daysAgo = (now - updated) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 14) score += 10;
  }

  // Active status (simple check)
  if (project.status && ['Scheduled', 'Parts Ordered', 'Quote Sent', 'Initial Site Visit'].includes(project.status)) {
    score += 5;
  }

  return score;
};

// Get reason label for suggestion
const getScoreReason = (project, thread, participants) => {
  if (project.customer_email && participants.includes(normalizeEmail(project.customer_email))) {
    return 'Matched email';
  }
  if (project.project_number && thread.subject?.includes(String(project.project_number))) {
    return `Project #${project.project_number}`;
  }
  if (project.customer_name && `${thread.subject || ''} ${thread.last_message_snippet || ''}`.toLowerCase().includes(project.customer_name.toLowerCase())) {
    return `Customer: ${project.customer_name}`;
  }
  if (project.updated_date && (Date.now() - new Date(project.updated_date).getTime()) / (1000 * 60 * 60 * 24) <= 14) {
    return 'Recently updated';
  }
  return 'Suggested';
};

export default function InboxV2ContextPanel({
  thread,
  teamUsers = [],
  onThreadUpdate,
  onOpenLinkModal,
  onOpenCreateProjectModal,
  currentUser,
}) {
  const queryClient = useQueryClient();
  const [projectSearch, setProjectSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [dismissedCategorySuggestion, setDismissedCategorySuggestion] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kgd_inboxv2_cat_dismissed') || '{}');
    } catch {
      return {};
    }
  });
  const searchInputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Fetch recent projects
  const { data: recentProjects = [] } = useQuery({
    queryKey: ['inboxV2RecentProjects'],
    queryFn: async () => {
      const projects = await base44.entities.Project.list('-updated_date', 200);
      return projects || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!thread,
  });

  // Fetch audit entries for this thread
  const { data: audits = [] } = useQuery({
    queryKey: ['threadAudits', thread?.id],
    queryFn: async () => {
      if (!thread?.id) return [];
      return base44.entities.EmailAudit?.filter?.(
        { thread_id: thread.id },
        '-created_date'
      ) || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!thread?.id,
  });

  // Get participants
  const participants = useMemo(() => getThreadParticipants(thread), [thread]);

  // Score and filter projects
  const suggestedProjects = useMemo(() => {
    if (!recentProjects.length) return [];
    
    const scored = recentProjects.map((p) => ({
      ...p,
      _score: scoreProjectForThread(p, thread, participants),
      _reason: getScoreReason(p, thread, participants),
    }));

    // Filter by score >= 25, take top 5
    return scored.filter((p) => p._score >= 25).slice(0, 5);
  }, [recentProjects, thread, participants]);

  // Auto-focus search input when panel opens for unlinked thread
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  // Search results (filtered recent projects)
  const searchResults = useMemo(() => {
    if (!projectSearch.trim()) {
      return recentProjects.slice(0, 20);
    }

    const query = projectSearch.toLowerCase();
    return recentProjects.filter(
      (p) =>
        p.title?.toLowerCase().includes(query) ||
        p.customer_name?.toLowerCase().includes(query) ||
        String(p.project_number || '').includes(query) ||
        p.address_suburb?.toLowerCase().includes(query) ||
        p.address_full?.toLowerCase().includes(query)
    );
  }, [projectSearch, recentProjects]);

  // Derived values
  const isLinked = thread?.project_id || thread?.contract_id;
  const linkedType = thread?.project_id ? 'project' : thread?.contract_id ? 'contract' : null;
  const linkedTitle = thread?.project_title || thread?.contract_name || '';
  const isClosed = thread?.userStatus === 'closed';
  const canonicalStatus = isClosed ? 'done' : thread?.next_action_status || 'needs_action';

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (projectId) => {
      const response = await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: thread.id,
        project_id: projectId,
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to link');
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      const projName = data.project_name || 'Project';
      toast.success(`Linked to ${projName}`);

      // Audit: link
      if (currentUser) {
        base44.entities.EmailAudit?.create?.({
          thread_id: thread.id,
          type: 'linked',
          message: `Linked to Project ${projName}`,
          actor_user_id: currentUser.id,
          actor_name: currentUser.display_name || currentUser.full_name || currentUser.email,
        }).catch(() => {});
      }

      onThreadUpdate?.();
      setShowSearch(false);
      setProjectSearch('');
      setSelectedProjectId(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to link thread'),
  });

  // Assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (userEmail) => {
      await base44.functions.invoke('assignEmailThread', {
        thread_id: thread.id,
        assigned_to_user_email: userEmail || null,
      });
    },
    onSuccess: (_, userEmail) => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });

      // Audit: owner change
      if (currentUser) {
        const assignee = teamUsers.find((u) => u.email === userEmail);
        const message = userEmail
          ? `Assigned to ${assignee?.display_name || userEmail}`
          : 'Unassigned';
        
        base44.entities.EmailAudit?.create?.({
          thread_id: thread.id,
          type: 'owner_changed',
          message,
          actor_user_id: currentUser.id,
          actor_name: currentUser.display_name || currentUser.full_name || currentUser.email,
        }).catch(() => {});
      }

      onThreadUpdate?.();
      toast.success(thread.assigned_to ? 'Owner changed' : 'Owner assigned');
    },
    onError: () => toast.error('Failed to assign thread'),
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async (status) => {
      await base44.entities.EmailThread.update(thread.id, {
        next_action_status: status,
      });
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });

      // Audit: status change
      if (currentUser) {
        const labels = {
          needs_action: 'Needs Action',
          waiting: 'Waiting',
          fyi: 'FYI',
        };
        base44.entities.EmailAudit?.create?.({
          thread_id: thread.id,
          type: 'status_changed',
          message: `Status changed to ${labels[status] || status}`,
          actor_user_id: currentUser.id,
          actor_name: currentUser.display_name || currentUser.full_name || currentUser.email,
        }).catch(() => {});
      }

      onThreadUpdate?.();
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Done/Reopen mutation
  const closeMutation = useMutation({
    mutationFn: async (shouldClose) => {
      if (shouldClose) {
        await base44.entities.EmailThread.update(thread.id, { userStatus: 'closed' });
      } else {
        await base44.entities.EmailThread.update(thread.id, {
          userStatus: null,
          next_action_status: 'needs_action',
        });
      }
    },
    onSuccess: (_, shouldClose) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });

      // Audit: done/reopen
      if (currentUser) {
        base44.entities.EmailAudit?.create?.({
          thread_id: thread.id,
          type: 'status_changed',
          message: shouldClose ? 'Marked done' : 'Reopened',
          actor_user_id: currentUser.id,
          actor_name: currentUser.display_name || currentUser.full_name || currentUser.email,
        }).catch(() => {});
      }

      onThreadUpdate?.();
      toast.success(isClosed ? 'Reopened' : 'Marked as Done');
    },
    onError: () => toast.error('Failed to update'),
  });

  // Category mutation
  const categoryMutation = useMutation({
    mutationFn: async (categoryValue) => {
      await base44.entities.EmailThread.update(thread.id, {
        category: categoryValue === 'uncategorised' ? null : categoryValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      onThreadUpdate?.();
      toast.success('Category updated');
    },
    onError: () => toast.error('Failed to update category'),
  });

  // Compute category suggestion
  const rawCategory = thread?.category || null;
  const categoryFromThread = rawCategory === "uncategorised" ? null : rawCategory;
  const shouldShowSuggestion = !categoryFromThread && !dismissedCategorySuggestion[thread?.id];
  const categorySuggestion = shouldShowSuggestion ? suggestCategoryInContext(thread) : null;
  
  // Only show suggestion if it's meaningful (not uncategorised and above confidence threshold)
  const meaningfulSuggestion = 
    categorySuggestion &&
    categorySuggestion.value &&
    categorySuggestion.value !== "uncategorised" &&
    (categorySuggestion.confidence ?? 0) >= MIN_CATEGORY_CONFIDENCE;

  // Fetch notes for this thread
  const { data: notes = [] } = useQuery({
    queryKey: ["threadNotes", thread?.id],
    queryFn: async () => {
      if (!thread?.id) return [];
      return base44.entities.EmailThreadNote.filter({ thread_id: thread.id }, "-created_date");
    },
    enabled: !!thread?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (body) => {
      const trimmed = String(body || "").trim();
      if (!trimmed) throw new Error("empty");
      return base44.entities.EmailThreadNote.create({
        thread_id: thread.id,
        note: trimmed,
        created_by: currentUser?.email || "Unknown",
        created_by_name: currentUser?.display_name || currentUser?.full_name || currentUser?.email || "Unknown",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threadNotes", thread.id] });
      // Audit
      if (currentUser && base44.entities.EmailAudit?.create) {
        base44.entities.EmailAudit.create({
          thread_id: thread.id,
          type: "note_added",
          message: "Note added",
          actor_user_id: currentUser.id,
          actor_name: currentUser.display_name || currentUser.full_name || currentUser.email,
        }).catch(() => {});
      }
      toast.success("Note added");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const [noteInput, setNoteInput] = useState("");
  const handleAddNote = () => {
    createNoteMutation.mutate(noteInput);
    setNoteInput("");
  };

  const handleApplyCategorySuggestion = () => {
    if (categorySuggestion?.value) {
      categoryMutation.mutate(categorySuggestion.value);
    }
  };

  const handleDismissCategorySuggestion = () => {
    const updated = { ...dismissedCategorySuggestion, [thread.id]: true };
    setDismissedCategorySuggestion(updated);
    localStorage.setItem('kgd_inboxv2_cat_dismissed', JSON.stringify(updated));
  };

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-4">
        <div>
          <LinkIcon className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
          <p className="text-[13px] text-[#6B7280]">Select a thread to triage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto space-y-3 p-4">
      {/* Triage Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
        <div className="text-sm font-semibold text-blue-900">Quick Triage</div>

        {/* Category Section */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Category</div>
          <Select
            value={categoryFromThread || 'uncategorised'}
            onValueChange={(val) => categoryMutation.mutate(val)}
            disabled={categoryMutation.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Suggestion chip - only show if meaningful */}
          {meaningfulSuggestion && (
            <div className="mt-2 p-2 bg-white rounded border border-[#E5E7EB] space-y-2">
              <div className="text-xs text-[#4B5563]">
                <div className="font-medium">Suggested: {CATEGORIES.find(c => c.value === categorySuggestion.value)?.label}</div>
                <div className="text-[#9CA3AF] text-[11px] mt-0.5">{categorySuggestion.reason}</div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  onClick={handleApplyCategorySuggestion}
                  disabled={categoryMutation.isPending}
                  className="flex-1 h-6 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                  variant="outline"
                >
                  Apply
                </Button>
                <Button
                  onClick={handleDismissCategorySuggestion}
                  className="flex-1 h-6 text-xs bg-gray-50 text-gray-700 border border-[#E5E7EB] hover:bg-gray-100"
                  variant="outline"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Link Section */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Link to Project</div>
          {isLinked ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 text-xs">
                {linkedType}: {linkedTitle}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSearch(!showSearch)}
                className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-100"
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              {!showSearch ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowSearch(true)}
                    className="flex-1 h-7 text-xs bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
                    variant="outline"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" />
                    Link Project
                  </Button>
                  <Button
                    onClick={onOpenCreateProjectModal}
                    className="flex-1 h-7 text-xs bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
                    variant="outline"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Create
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {/* Search UI */}
          {showSearch && (
            <div className="space-y-2 pt-1 border-t border-blue-200">
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search projects… (name, #, address)"
                  value={projectSearch}
                  onChange={(e) => {
                    clearTimeout(debounceTimer.current);
                    setProjectSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowSearch(false);
                      setProjectSearch('');
                    } else if (e.key === 'Enter' && searchResults.length > 0) {
                      linkMutation.mutate(searchResults[0].id);
                    }
                  }}
                  className="h-7 text-xs"
                />
                {projectSearch && (
                  <button
                    onClick={() => setProjectSearch('')}
                    className="absolute right-2 top-1.5 text-[#9CA3AF] hover:text-[#111827]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Suggestions (when no search) */}
              {!projectSearch.trim() && suggestedProjects.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[#6B7280]">Suggested</div>
                  {suggestedProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => linkMutation.mutate(proj.id)}
                      disabled={linkMutation.isPending}
                      className="w-full text-left px-2 py-1.5 rounded bg-[#F9FAFB] hover:bg-blue-50 border border-[#E5E7EB] hover:border-blue-300 transition-colors text-xs disabled:opacity-50"
                    >
                      <div className="font-medium text-[#111827]">{proj.title}</div>
                      <div className="text-[#6B7280] mt-0.5 flex items-center justify-between">
                        <span>
                          {proj.project_number && `#${proj.project_number}`}
                          {proj.address_suburb && ` · ${proj.address_suburb}`}
                        </span>
                        <span className="flex items-center gap-1 text-[#9CA3AF] text-[10px]">
                          <Zap className="w-2.5 h-2.5" />
                          {proj._reason}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Search results */}
              {projectSearch.trim() && (
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="text-xs text-[#9CA3AF] text-center py-2">No projects found</div>
                  ) : (
                    searchResults.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => linkMutation.mutate(proj.id)}
                        disabled={linkMutation.isPending}
                        className="w-full text-left px-2 py-1.5 rounded bg-[#F9FAFB] hover:bg-blue-50 border border-[#E5E7EB] hover:border-blue-300 transition-colors text-xs disabled:opacity-50"
                      >
                        <div className="font-medium text-[#111827]">{proj.title}</div>
                        <div className="text-[#6B7280] mt-0.5">
                          {proj.project_number && `#${proj.project_number}`}
                          {proj.address_suburb && ` · ${proj.address_suburb}`}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              <Button
                onClick={() => {
                  setShowSearch(false);
                  setProjectSearch('');
                }}
                variant="ghost"
                className="w-full h-6 text-xs text-[#6B7280]"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Owner Section */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Owner</div>
          <Select
            value={thread.assigned_to || ''}
            onValueChange={(email) => assignmentMutation.mutate(email || null)}
            disabled={assignmentMutation.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Unassigned</SelectItem>
              {teamUsers.map((user) => (
                <SelectItem key={user.email} value={user.email}>
                  {user.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Next Action Section */}
        {!isClosed && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#6B7280]">Next Action</div>
            <div className="flex gap-1 flex-wrap">
              {['needs_action', 'waiting', 'fyi'].map((status) => (
                <Button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={statusMutation.isPending}
                  className={`flex-1 h-7 text-xs transition-colors ${
                    canonicalStatus === status
                      ? 'bg-[#FAE008] text-[#111827]'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
                  }`}
                  variant="outline"
                >
                  {status === 'needs_action' ? 'Needs Action' : status === 'waiting' ? 'Waiting' : 'FYI'}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Done/Reopen Section */}
        <div className="flex gap-2">
          {isClosed ? (
            <Button
              onClick={() => closeMutation.mutate(false)}
              disabled={closeMutation.isPending}
              className="flex-1 h-7 text-xs bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              variant="outline"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reopen
            </Button>
          ) : (
            <Button
              onClick={() => closeMutation.mutate(true)}
              disabled={closeMutation.isPending}
              className="flex-1 h-7 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
              variant="outline"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark Done
            </Button>
          )}
        </div>
      </div>

      {/* Original linked entity view (below triage) */}
      {thread.project_id && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Project Details</div>
          <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] space-y-2">
            <div className="text-sm font-semibold text-[#111827]">{thread.project_title || 'Project'}</div>
            {thread.project_number && (
              <div className="text-xs text-[#6B7280]">#{thread.project_number}</div>
            )}
            {thread.customer_name && (
              <div className="text-xs text-[#4B5563]">{thread.customer_name}</div>
            )}
            <Button
              onClick={() => (window.location.href = createPageUrl('Projects') + `?projectId=${thread.project_id}`)}
              className="w-full mt-3 h-7 text-xs bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              Open Project
            </Button>
          </div>
        </div>
      )}

      {thread.contract_id && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Contract Details</div>
          <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] space-y-2">
            <div className="text-sm font-semibold text-[#111827]">{thread.contract_name || 'Contract'}</div>
            {thread.contract_status && (
              <div className="text-xs text-[#6B7280]">{thread.contract_status}</div>
            )}
            <Button
              onClick={() => (window.location.href = createPageUrl('Contracts') + `?contractId=${thread.contract_id}`)}
              className="w-full mt-3 h-7 text-xs bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              Open Contract
            </Button>
          </div>
        </div>
      )}

      {/* Team Notes */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-[#6B7280]">Team Notes (Internal)</div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white space-y-2 p-3">
          {/* Notes list */}
          {notes.length > 0 && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="px-2 py-1.5 rounded bg-[#F9FAFB] border border-[#E5E7EB] text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#4B5563]">{note.created_by_name || note.created_by}</span>
                    <span className="text-[#9CA3AF] text-[10px]">
                      {new Date(note.created_date).toLocaleDateString()} {new Date(note.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[#111827] whitespace-pre-wrap">{note.note}</p>
                </div>
              ))}
            </div>
          )}
          {/* Add note */}
          <div className="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  handleAddNote();
                }
              }}
              placeholder="Add internal note… (Ctrl+Enter)"
              className="w-full h-16 p-2 border border-[#E5E7EB] rounded text-xs resize-none focus:outline-none focus:border-[#111827]"
            />
            <Button
              onClick={handleAddNote}
              disabled={!noteInput.trim() || createNoteMutation.isPending}
              className="w-full h-6 text-xs bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              {createNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {audits.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Activity</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {audits.map((audit) => (
              <div key={audit.id} className="px-2 py-1.5 rounded bg-[#F9FAFB] text-xs border border-[#E5E7EB]">
                <div className="text-[#111827] font-medium">{audit.actor_name}</div>
                <div className="text-[#6B7280] mt-0.5">{audit.message}</div>
                <div className="text-[#9CA3AF] text-[10px] mt-1">
                  {new Date(audit.created_date).toLocaleDateString()} {new Date(audit.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}