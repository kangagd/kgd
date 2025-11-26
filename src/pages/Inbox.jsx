import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, Mail, Link as LinkIcon, Check, Archive, Trash2, ArrowUpDown, SlidersHorizontal, Plus, Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmailThreadList from "../components/inbox/EmailThreadList";
import EmailDetailView from "../components/inbox/EmailDetailView";
import LinkThreadModal from "../components/inbox/LinkThreadModal";
import CreateProjectFromEmailModal from "../components/inbox/CreateProjectFromEmailModal";
import CreateJobFromEmailModal from "../components/inbox/CreateJobFromEmailModal";
import GmailConnect from "../components/inbox/GmailConnect";
import AdvancedSearch from "../components/inbox/AdvancedSearch";
import EmailComposer from "../components/inbox/EmailComposer";
import { toast } from "sonner";

export default function Inbox() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const threadIdFromUrl = searchParams.get('threadId');
  
  const [searchFilters, setSearchFilters] = useState({
    searchText: "",
    sender: "",
    recipient: "",
    dateFrom: "",
    dateTo: "",
    hasAttachment: false,
    attachmentName: "",
    searchInBody: true,
    statusFilter: "all"
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkType, setLinkType] = useState(null);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Load user permissions
        const permissions = await base44.entities.EmailPermission.filter({ user_email: currentUser.email });
        if (permissions.length > 0) {
          setUserPermissions(permissions[0]);
        } else if (currentUser.role === 'admin') {
          // Auto-create full permissions for admin
          const newPerm = await base44.entities.EmailPermission.create({
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            can_view: true,
            can_link_to_project: true,
            can_link_to_job: true,
            can_create_project_from_email: true,
            can_create_job_from_email: true,
            can_reply: true,
            can_assign: true,
            can_change_status: true
          });
          setUserPermissions(newPerm);
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['emailThreads'],
    queryFn: () => base44.entities.EmailThread.list('-last_message_date'),
    enabled: !!userPermissions?.can_view,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });
  
  // Sync selectedThread with URL parameter
  useEffect(() => {
    if (threadIdFromUrl && threads.length > 0) {
      const thread = threads.find(t => t.id === threadIdFromUrl);
      if (thread) {
        setSelectedThread(thread);
      }
    } else if (!threadIdFromUrl && selectedThread) {
      setSelectedThread(null);
    }
  }, [threadIdFromUrl, threads]);

  const { data: messages = [] } = useQuery({
    queryKey: ['allEmailMessages'],
    queryFn: () => base44.entities.EmailMessage.list(),
    enabled: !!userPermissions?.can_view && searchFilters.searchInBody
  });

  // Auto-sync Gmail in background
  useEffect(() => {
    if (!user?.gmail_access_token) return;
    
    const syncGmail = async () => {
      try {
        const result = await base44.functions.invoke('gmailSync', {});
        if (result?.data) {
          queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
        console.error('Background sync failed:', error);
      }
    };
    
    // Initial sync after a small delay
    const timeout = setTimeout(syncGmail, 2000);
    
    // Sync every 60 seconds (reduced frequency to avoid rate limits)
    const interval = setInterval(syncGmail, 60000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user, queryClient]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const updateThreadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailThread.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      if (selectedThread) {
        const updated = threads.find(t => t.id === selectedThread.id);
        if (updated) setSelectedThread(updated);
      }
    }
  });

  const filteredThreads = threads.filter(thread => {
    // Skip deleted threads
    if (thread.is_deleted) return false;
    // Text search
    let matchesSearch = true;
    if (searchFilters.searchText) {
      const searchLower = searchFilters.searchText.toLowerCase();
      const subjectMatch = thread.subject?.toLowerCase().includes(searchLower);
      const fromMatch = thread.from_address?.toLowerCase().includes(searchLower);
      const toMatch = thread.to_addresses?.some(addr => addr.toLowerCase().includes(searchLower));
      
      // Search in email body if enabled
      let bodyMatch = false;
      if (searchFilters.searchInBody && messages.length > 0) {
        const threadMessages = messages.filter(m => m.thread_id === thread.id);
        bodyMatch = threadMessages.some(m => 
          m.body_text?.toLowerCase().includes(searchLower) ||
          m.body_html?.toLowerCase().includes(searchLower)
        );
      }
      
      matchesSearch = subjectMatch || fromMatch || toMatch || bodyMatch;
    }

    // Sender filter
    const matchesSender = !searchFilters.sender || 
      thread.from_address?.toLowerCase().includes(searchFilters.sender.toLowerCase());

    // Recipient filter
    const matchesRecipient = !searchFilters.recipient ||
      thread.to_addresses?.some(addr => 
        addr.toLowerCase().includes(searchFilters.recipient.toLowerCase())
      );

    // Date range filter
    const threadDate = new Date(thread.last_message_date);
    const matchesDateFrom = !searchFilters.dateFrom || 
      threadDate >= new Date(searchFilters.dateFrom);
    const matchesDateTo = !searchFilters.dateTo || 
      threadDate <= new Date(searchFilters.dateTo + 'T23:59:59');

    // Attachment filter
    const matchesAttachment = !searchFilters.hasAttachment || (() => {
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      return threadMessages.some(m => m.attachments && m.attachments.length > 0);
    })();

    // Attachment name filter
    const matchesAttachmentName = !searchFilters.attachmentName || (() => {
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      return threadMessages.some(m => 
        m.attachments && m.attachments.some(att => 
          att.filename?.toLowerCase().includes(searchFilters.attachmentName.toLowerCase())
        )
      );
    })();

    // Advanced status filter (from search filters)
    const matchesAdvancedStatus = searchFilters.statusFilter === "all" || thread.status === searchFilters.statusFilter;

    // "Sent" tab filter - show threads where first message was outbound
    const matchesSentFilter = statusFilter !== "sent" || (() => {
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      // Check if there are any outbound messages in this thread
      return threadMessages.some(m => m.is_outbound === true);
    })();

    const matchesStatus = statusFilter === "all" || statusFilter === "sent" || thread.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || thread.priority === priorityFilter;

    return matchesSearch && matchesSender && matchesRecipient && 
           matchesDateFrom && matchesDateTo && matchesAttachment && 
           matchesAttachmentName && matchesAdvancedStatus &&
           matchesStatus && matchesPriority && matchesSentFilter;
  }).sort((a, b) => {
    switch(sortBy) {
      case "date":
        return new Date(b.last_message_date) - new Date(a.last_message_date);
      case "sender":
        return (a.from_address || "").localeCompare(b.from_address || "");
      case "subject":
        return (a.subject || "").localeCompare(b.subject || "");
      case "unread":
        return (b.is_read ? 0 : 1) - (a.is_read ? 0 : 1);
      case "priority":
        const priorityOrder = { "High": 3, "Normal": 2, "Low": 1 };
        return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      default:
        return 0;
    }
  });

  const handleStatusChange = (threadId, newStatus) => {
    updateThreadMutation.mutate({ id: threadId, data: { status: newStatus } });
  };

  const handleLinkProject = (projectId, projectTitle) => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_project_id: projectId, linked_project_title: projectTitle }
    });
    setLinkModalOpen(false);
  };

  const handleLinkJob = (jobId, jobNumber) => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_job_id: jobId, linked_job_number: jobNumber }
    });
    setLinkModalOpen(false);
  };

  const handleUnlinkProject = () => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_project_id: null, linked_project_title: null }
    });
  };

  const handleUnlinkJob = () => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_job_id: null, linked_job_number: null }
    });
  };

  const openLinkModal = (type) => {
    setLinkType(type);
    setLinkModalOpen(true);
  };

  const handleBulkStatusChange = async (status) => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { status })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  };

  const handleBulkMarkRead = async (isRead) => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { is_read: isRead })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  };

  const handleBulkArchive = async () => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { status: "Archived" })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedThreadIds.length} email thread(s)?`)) return;
    // Soft delete - mark as deleted instead of actually deleting
    await Promise.all(
      selectedThreadIds.map(id => base44.entities.EmailThread.update(id, { is_deleted: true }))
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
    if (selectedThread && selectedThreadIds.includes(selectedThread.id)) {
      setSelectedThread(null);
    }
  };

  const handleToggleSelection = (threadId) => {
    setSelectedThreadIds(prev => 
      prev.includes(threadId) 
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedThreadIds.length === filteredThreads.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(filteredThreads.map(t => t.id));
    }
  };

  const handleAnalyzeAllEmails = async () => {
    // Find threads without AI tags
    const threadsToAnalyze = threads.filter(t => !t.ai_tags || t.ai_tags.length === 0);
    
    if (threadsToAnalyze.length === 0) {
      toast.info('All emails have already been analyzed');
      return;
    }

    setIsAnalyzingAll(true);
    toast.info(`Analyzing ${threadsToAnalyze.length} emails...`);

    let successCount = 0;
    let errorCount = 0;

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < threadsToAnalyze.length; i += 3) {
      const batch = threadsToAnalyze.slice(i, i + 3);
      
      await Promise.all(batch.map(async (thread) => {
        try {
          await base44.functions.invoke('generateEmailThreadInsights', {
            email_thread_id: thread.id
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to analyze thread ${thread.id}:`, error);
          errorCount++;
        }
      }));

      // Update progress
      if (i + 3 < threadsToAnalyze.length) {
        toast.info(`Progress: ${Math.min(i + 3, threadsToAnalyze.length)}/${threadsToAnalyze.length} emails analyzed`);
      }
    }

    setIsAnalyzingAll(false);
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    
    if (errorCount === 0) {
      toast.success(`Successfully analyzed ${successCount} emails with AI tagging and priority`);
    } else {
      toast.warning(`Analyzed ${successCount} emails. ${errorCount} failed.`);
    }
  };

  if (!userPermissions?.can_view) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-4xl mx-auto text-center py-20">
          <Mail className="w-16 h-16 mx-auto text-[#D1D5DB] mb-4" />
          <h2 className="text-[22px] font-semibold text-[#111827] mb-2">Access Required</h2>
          <p className="text-[14px] text-[#4B5563]">
            You don't have permission to view the inbox. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] lg:h-screen bg-[#ffffff] overflow-hidden">
      {/* Thread List - Left Side */}
      <div 
        className={`${selectedThread ? 'hidden lg:flex' : 'flex'} flex-col border-r border-[#E5E7EB] bg-white overflow-x-hidden`}
        style={{ width: selectedThread ? `${sidebarWidth}px` : '100%' }}
      >
        <div className="p-4 md:p-5 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between py-3 lg:py-4 gap-3">
            <GmailConnect 
              user={user} 
              onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['emailThreads'] })} 
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAnalyzeAllEmails}
                size="sm"
                variant="outline"
                disabled={isAnalyzingAll}
                className="h-9"
                title="Analyze all emails with AI to add tags and priority"
              >
                {isAnalyzingAll ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1 text-purple-500" />
                )}
                {isAnalyzingAll ? 'Analyzing...' : 'AI Analyze All'}
              </Button>
              <Button
                onClick={() => setShowComposer(true)}
                size="sm"
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Email
              </Button>
            </div>
          </div>
          
          <div className="mt-3">
            <AdvancedSearch
              onSearchChange={setSearchFilters}
              currentFilters={searchFilters}
            />
          </div>

          <div className="flex flex-col gap-3 mt-3">
            <div className="flex gap-3">
              <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0 flex-1">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                  <TabsList className="w-full grid grid-cols-5 gap-1 min-w-max md:min-w-0">
                    <TabsTrigger value="all" className="whitespace-nowrap">All</TabsTrigger>
                    <TabsTrigger value="Open" className="whitespace-nowrap">Open</TabsTrigger>
                    <TabsTrigger value="In Progress" className="whitespace-nowrap">Active</TabsTrigger>
                    <TabsTrigger value="Closed" className="whitespace-nowrap">Closed</TabsTrigger>
                    <TabsTrigger value="sent" className="whitespace-nowrap">Sent</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {!selectedThread && (
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex-shrink-0 h-10 px-3 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                >
                  <SlidersHorizontal className="w-5 h-5 mr-2" />
                  Filters
                </Button>
              )}
            </div>

            {showFilters && (
              <Card className="border border-[#E5E7EB]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-3">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-full md:w-[180px] h-11">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="High">🔴 High</SelectItem>
                        <SelectItem value="Normal">🟡 Normal</SelectItem>
                        <SelectItem value="Low">🟢 Low</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full md:w-[200px] h-11">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="sender">Sender</SelectItem>
                        <SelectItem value="subject">Subject</SelectItem>
                        <SelectItem value="unread">Unread First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {selectedThreadIds.length > 0 && (
          <div className="px-4 md:px-5 py-3 bg-[#FAE008]/20 border-b border-[#FAE008]/30 overflow-x-hidden">
            <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0">
              <div className="flex items-center gap-3 min-w-max md:min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkMarkRead(true)}
              className="h-8"
            >
              Mark Read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkMarkRead(false)}
              className="h-8"
            >
              Mark Unread
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  Change Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("Open")}>
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("In Progress")}>
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("Closed")}>
                  Closed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkArchive}
              className="h-8 gap-2"
            >
              <Archive className="w-4 h-4" />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedThreadIds([])}
              className="h-8"
            >
              Cancel
            </Button>
              </div>
            </div>
          </div>
        )}

        <EmailThreadList
          threads={filteredThreads}
          selectedThread={selectedThread}
          onSelectThread={(thread) => {
            if (thread) {
              navigate(`?threadId=${thread.id}`, { replace: true });
            } else {
              navigate('', { replace: true });
            }
          }}
          isLoading={isLoading}
          selectedThreadIds={selectedThreadIds}
          onToggleSelection={handleToggleSelection}
          onSelectAll={handleSelectAll}
          onBulkDelete={handleBulkDelete}
          onDeleteThread={async (threadId) => {
            // Soft delete - mark as deleted instead of actually deleting
            await base44.entities.EmailThread.update(threadId, { is_deleted: true });
            queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
            if (selectedThread?.id === threadId) {
              navigate('', { replace: true });
            }
          }}
        />
      </div>

      {/* Resize Handle */}
      {selectedThread && (
        <div
          className="hidden lg:block w-1 bg-[#E5E7EB] hover:bg-[#FAE008] cursor-col-resize transition-colors relative group"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Thread Detail - Right Side */}
      {selectedThread && (
        <div className="flex flex-1 flex-col bg-[#ffffff]">
          <EmailDetailView
            thread={selectedThread}
            onClose={() => navigate('', { replace: true })}
            onLinkProject={() => openLinkModal('project')}
            onLinkJob={() => openLinkModal('job')}
            onUnlinkProject={handleUnlinkProject}
            onUnlinkJob={handleUnlinkJob}
            userPermissions={userPermissions}
            onDelete={async (threadId) => {
              // Soft delete - mark as deleted instead of actually deleting
              await base44.entities.EmailThread.update(threadId, { is_deleted: true });
              queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
              setSelectedThread(null);
            }}
            onThreadUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
            }}
          />
        </div>
      )}

      {/* Modals */}
      {linkModalOpen && (
        <LinkThreadModal
          open={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          linkType={linkType}
          onLinkProject={handleLinkProject}
          onLinkJob={handleLinkJob}
        />
      )}

      {createProjectModalOpen && (
        <CreateProjectFromEmailModal
          open={createProjectModalOpen}
          onClose={() => setCreateProjectModalOpen(false)}
          thread={selectedThread}
          onSuccess={(projectId, projectTitle) => {
            handleLinkProject(projectId, projectTitle);
            setCreateProjectModalOpen(false);
          }}
        />
      )}

      {createJobModalOpen && (
        <CreateJobFromEmailModal
          open={createJobModalOpen}
          onClose={() => setCreateJobModalOpen(false)}
          thread={selectedThread}
          onSuccess={(jobId, jobNumber) => {
            handleLinkJob(jobId, jobNumber);
            setCreateJobModalOpen(false);
          }}
        />
      )}

      {/* New Email Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <EmailComposer
              mode="compose"
              onClose={() => setShowComposer(false)}
              onSent={() => {
                queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
                setShowComposer(false);
              }}
            />
          </div>
        </div>
      )}
      </div>
      );
}