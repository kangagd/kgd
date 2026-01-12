import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Mail, AlertTriangle, Loader } from "lucide-react";
import { toast } from "sonner";
import ThreadRow from "@/components/inbox/ThreadRow";
import ThreadHeader from "@/components/inbox/ThreadHeader";
import InboxFilterBar from "@/components/inbox/InboxFilterBar";
import SharedComposer from "@/components/inbox/SharedComposer";
import EmailDetailView from "@/components/inbox/EmailDetailView";
import LinkThreadModal from "@/components/inbox/LinkThreadModal";
import GmailHistorySearch from "@/components/inbox/GmailHistorySearch";

export default function Inbox() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showComposer, setShowComposer] = useState(false);
  const [composerMessage, setComposerMessage] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastThreadFetchTime, setLastThreadFetchTime] = useState(0);
  const [lastSyncRequestTime, setLastSyncRequestTime] = useState(0); // B8: Rate limit sync calls

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
    const threadId = params.get('threadId');
    if (threadId && threadId !== selectedThreadId) {
      setSelectedThreadId(threadId);
    }
  }, []);

  // Fetch all email threads with viewers
  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['emailThreads'],
    queryFn: async () => {
      setLastThreadFetchTime(Date.now());
      const allThreads = await base44.entities.EmailThread.list('-last_message_date', 100);
      const viewers = await base44.entities.EmailThreadViewer.list();
      
      return allThreads.filter(t => !t.is_deleted).map(thread => ({
        ...thread,
        viewers: viewers.filter(v => v.thread_id === thread.id)
      }));
    },
    enabled: !!user,
    staleTime: 30000, // Keep data fresh for 30s to prevent excessive refetches
    onSuccess: (newThreads) => {
      // B6: Fix thread selection desync after refetch
      if (selectedThreadId && !newThreads.find(t => t.id === selectedThreadId)) {
        // Selected thread no longer in list; reset intelligently
        // Prefer: next available thread > first thread > null
        const currentIndex = threads.findIndex(t => t.id === selectedThreadId);
        const nextThread = newThreads[Math.min(currentIndex, newThreads.length - 1)];
        setSelectedThreadId(nextThread?.id || null);
        console.log(`[B6] Thread selection reset: ${selectedThreadId} not found, selected ${nextThread?.id || 'null'}`);
      }
    }
  });

  // Real-time subscription for EmailThread updates (debounced with staleTime gating)
  useEffect(() => {
    if (!user) return;

    let debounceTimer;
    const unsubscribe = base44.entities.EmailThread.subscribe((event) => {
      // Only invalidate if data is older than 30s (staleTime)
      const now = Date.now();
      if (now - lastThreadFetchTime < 30000) {
        // Data is fresh, skip refetch
        return;
      }

      // Debounce refetch to 500ms to batch multiple updates
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      }, 500);
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [user, queryClient, lastThreadFetchTime]);

  // Sync Gmail inbox
  const syncGmailInbox = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      await base44.functions.invoke('gmailSyncInbox', { maxResults: 50 });
      await refetchThreads();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync emails');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync on mount and when tab becomes visible (with staleTime gating)
  useEffect(() => {
    if (!user) return;

    // Initial sync
    syncGmailInbox();

    // Sync when tab becomes visible (only if data is stale)
    let visibilityTimeout;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          // Only sync if last fetch is older than 30s
          const now = Date.now();
          if (now - lastThreadFetchTime >= 30000) {
            syncGmailInbox();
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(visibilityTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, lastThreadFetchTime]);

  // Fetch team members for assignment
  const { data: teamUsers = [] } = useQuery({
    queryKey: ['teamUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Fetch drafts for selected thread
  const { data: threadDrafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['threadDrafts', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId || !user) return [];
      const drafts = await base44.entities.EmailDraft.filter({ 
        thread_id: selectedThreadId,
        created_by: user.email 
      }, '-updated_date');
      return drafts;
    },
    enabled: !!selectedThreadId && !!user
  });

  // Apply filters and search
  const filteredThreads = useMemo(() => {
    let result = threads.filter(t => !t.is_deleted);

    // Text search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.subject?.toLowerCase().includes(search) ||
        t.customer_name?.toLowerCase().includes(search) ||
        t.from_address?.toLowerCase().includes(search) ||
        t.to_addresses?.some(addr => addr?.toLowerCase().includes(search)) ||
        t.last_message_snippet?.toLowerCase().includes(search)
      );
    }

    // Status and assignment filters
    if (activeFilters['assigned-to-me']) {
      result = result.filter(t => t.assigned_to === user?.email);
    }
    if (activeFilters['unassigned']) {
      result = result.filter(t => !t.assigned_to);
    }
    if (activeFilters['needs-reply']) {
      result = result.filter(t => !t.is_read);
    }
    if (activeFilters['linked-project']) {
      result = result.filter(t => t.project_id);
    }
    if (activeFilters['closed']) {
      result = result.filter(t => t.status === 'Closed');
    }

    return result.sort((a, b) => new Date(b.last_message_date) - new Date(a.last_message_date));
  }, [threads, searchTerm, activeFilters, user?.email]);

  const selectedThread = useMemo(() => {
    return selectedThreadId ? threads.find(t => t.id === selectedThreadId) : null;
  }, [selectedThreadId, threads]);

  // Handle status changes
  const handleStatusChange = async (newStatus) => {
    if (!selectedThread) return;
    try {
      await base44.entities.EmailThread.update(selectedThread.id, { status: newStatus });
      await refetchThreads();
      toast.success(`Status changed to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Handle assignment changes
  const handleAssignChange = async (userEmail) => {
    if (!selectedThread) return;
    try {
      const assignedUser = teamUsers.find(u => u.email === userEmail);
      await base44.entities.EmailThread.update(selectedThread.id, {
        assigned_to: userEmail || null,
        assigned_to_name: assignedUser?.full_name || null
      });
      await refetchThreads();
      toast.success(userEmail ? `Assigned to ${assignedUser?.full_name}` : "Unassigned");
    } catch (error) {
      toast.error("Failed to assign thread");
    }
  };

  // Track thread view (debounced - only update once per 10 seconds)
  useEffect(() => {
    if (!selectedThread || !user) return;

    const timeout = setTimeout(() => {
      // Update existing viewer or create new one
      base44.entities.EmailThreadViewer.filter({
        thread_id: selectedThread.id,
        user_email: user.email
      }).then(existing => {
        if (existing.length > 0) {
          // Just update last_seen without triggering full refetch
          base44.asServiceRole.entities.EmailThreadViewer.update(existing[0].id, {
            last_seen: new Date().toISOString()
          }).catch(() => {});
        } else {
          base44.entities.EmailThreadViewer.create({
            thread_id: selectedThread.id,
            user_email: user.email,
            user_name: user.full_name,
            last_seen: new Date().toISOString()
          }).catch(() => {});
        }
      }).catch(() => {});
    }, 10000); // Debounce 10 seconds

    return () => clearTimeout(timeout);
  }, [selectedThread?.id, user?.email]);

  // Handle email sent
  const handleComposerSent = async () => {
    setShowComposer(false);
    setComposerMessage(null);
    await refetchThreads();
    await refetchDrafts();
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: ['emailThread', selectedThread.id] });
    }
  };

  // Handle draft click
  const handleEditDraft = (draft) => {
    setComposerMessage({ draft });
    setShowComposer(true);
  };

  // Link thread to project
  const linkThreadMutation = useMutation({
    mutationFn: async (projectId) => {
      if (!selectedThread) return;
      await base44.entities.EmailThread.update(selectedThread.id, { project_id: projectId });
    },
    onSuccess: () => {
      refetchThreads();
      setShowLinkModal(false);
      toast.success('Thread linked to project');
    },
    onError: () => {
      toast.error('Failed to link thread');
    }
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
      {/* Two-Pane Layout */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        
        {/* Left Pane: Thread List */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-[#E5E7EB] overflow-hidden">
          
          {/* Filter Bar */}
          <InboxFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFilterChange={(filterId, filterValue) => {
              if (filterId === 'clear') {
                setActiveFilters({});
              } else {
                setActiveFilters(prev => ({
                  ...prev,
                  [filterId]: filterValue ? true : false
                }));
              }
            }}
            userEmail={user?.email}
            onOpenHistorySearch={() => setShowHistorySearch(true)}
          />

          {/* Sync Status Indicator */}
          <div className="px-3 py-2 border-b border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              {isSyncing ? (
                <span className="flex items-center gap-1.5">
                  <Loader className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              ) : lastSyncTime ? (
                `Last synced: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              ) : (
                'Not synced yet'
              )}
            </span>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {threadsLoading ? (
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
              filteredThreads.map(thread => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Thread Detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFB]">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <ThreadHeader
                thread={selectedThread}
                users={teamUsers}
                onStatusChange={handleStatusChange}
                onAssignChange={handleAssignChange}
              />

              {/* Messages & Composer */}
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                   <EmailDetailView
                     thread={selectedThread}
                     userPermissions={{
                       can_reply: true,
                       can_change_status: true,
                       can_link_to_project: true,
                       can_create_project_from_email: true,
                       can_create_job_from_email: true
                     }}
                     onClose={() => setSelectedThreadId(null)}
                     onLinkProject={() => setShowLinkModal(true)}
                     onLinkJob={() => {}}
                     onUnlinkProject={async () => {
                       try {
                         await base44.entities.EmailThread.update(selectedThread.id, { project_id: null });
                         await refetchThreads();
                         toast.success('Thread unlinked from project');
                       } catch (error) {
                         toast.error('Failed to unlink thread');
                       }
                     }}
                     onUnlinkJob={() => {}}
                     onDelete={async (threadId) => {
                       try {
                         await base44.entities.EmailThread.update(threadId, { is_deleted: true });
                         await refetchThreads();
                         setSelectedThreadId(null);
                         toast.success('Thread deleted');
                       } catch (error) {
                         toast.error('Failed to delete thread');
                       }
                     }}
                     onThreadUpdate={refetchThreads}
                   />

                   {/* Draft Emails */}
                   {threadDrafts.length > 0 && (
                     <div className="mt-4 space-y-2">
                       <div className="text-xs font-medium text-[#6B7280] mb-2">Drafts</div>
                       {threadDrafts.map(draft => (
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
                           {draft.subject && (
                             <div className="text-sm font-medium text-[#111827] mb-1">{draft.subject}</div>
                           )}
                           <div className="text-xs text-[#6B7280] line-clamp-2">
                             {draft.body_text?.substring(0, 150) || 'No content'}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                {/* Composer Section */}
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

      {/* Link Thread Modal */}
      {selectedThread && (
        <LinkThreadModal
          open={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          linkType="project"
          onLinkProject={(projectId) => linkThreadMutation.mutate(projectId)}
          onLinkJob={() => {}}
        />
      )}

      {/* Gmail History Search */}
      <GmailHistorySearch
        open={showHistorySearch}
        onClose={() => {
          setShowHistorySearch(false);
        }}
        onThreadSynced={(threadId) => {
          refetchThreads();
          setSelectedThreadId(threadId);
          setShowHistorySearch(false);
        }}
      />
    </div>
  );
}