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

export default function Inbox() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showComposer, setShowComposer] = useState(false);
  const [composerMessage, setComposerMessage] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

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

  // Fetch all email threads
  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['emailThreads'],
    queryFn: async () => {
      const allThreads = await base44.entities.EmailThread.list('-last_message_date', 100);
      return allThreads.filter(t => !t.is_deleted);
    },
    enabled: !!user
  });

  // Fetch team members for assignment
  const { data: teamUsers = [] } = useQuery({
    queryKey: ['teamUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Apply filters and search
  const filteredThreads = useMemo(() => {
    let result = threads.filter(t => !t.is_deleted);

    // Text search
    if (searchTerm) {
      result = result.filter(t =>
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Handle email sent
  const handleComposerSent = async () => {
    setShowComposer(false);
    setComposerMessage(null);
    await refetchThreads();
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: ['emailThread', selectedThread.id] });
    }
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
          />

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
                 </div>

                {/* Composer Section */}
                {showComposer && (
                  <div className="border-t border-[#E5E7EB] p-4 bg-white flex-shrink-0">
                    <SharedComposer
                      mode="reply"
                      thread={selectedThread}
                      message={composerMessage?.message}
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
          threadId={selectedThread.id}
          onLink={(projectId) => linkThreadMutation.mutate(projectId)}
          isLinking={linkThreadMutation.isPending}
        />
      )}
    </div>
  );
}