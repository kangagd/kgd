import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Archive, Trash2, SlidersHorizontal, Plus, Sparkles, Loader2, Paperclip, Settings, Link as LinkIcon } from "lucide-react";
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
import GmailHistorySearch from "../components/inbox/GmailHistorySearch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { FileEdit, History } from "lucide-react";
import { createPageUrl } from "@/utils";

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
  const debouncedSearchFilters = useDebounce(searchFilters, 250);
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
  const sidebarRef = useRef(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [showHistorySearch, setShowHistorySearch] = useState(false);
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
        } else if (currentUser.role === 'admin' || currentUser.extended_role === 'manager') {
          // Auto-create full permissions for admin and manager
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
    queryFn: async () => {
      const response = await base44.functions.invoke('getMyEmailThreads');
      return response.data?.threads || [];
    },
    enabled: !!userPermissions?.can_view,
    refetchInterval: 60000 // Auto-refresh every 60 seconds
  });

  // Fetch email drafts
  const { data: drafts = [] } = useQuery({
    queryKey: ['emailDrafts'],
    queryFn: () => base44.entities.EmailDraft.filter({ created_by: user?.email }, '-updated_date'),
    enabled: !!user?.email && !!userPermissions?.can_view
  });
  
  // Sync selectedThread with URL parameter
  useEffect(() => {
    if (threadIdFromUrl && threads.length > 0) {
      const thread = threads.find(t => t.id === threadIdFromUrl);
      if (thread && (!selectedThread || selectedThread.id !== thread.id)) {
        setSelectedThread(thread);
      }
    } else if (!threadIdFromUrl && selectedThread) {
      setSelectedThread(null);
    }
  }, [threadIdFromUrl, threads, selectedThread?.id]);

  const { data: messages = [] } = useQuery({
    queryKey: ['allEmailMessages'],
    queryFn: () => base44.entities.EmailMessage.list(),
    enabled: !!userPermissions?.can_view && searchFilters.searchInBody
  });

  // Auto-sync Gmail in background
  useEffect(() => {
    // Allow auto-sync for admin (with token) and managers (using admin's token)
    if (!user) return;
    if (!user.gmail_access_token && user.extended_role !== 'manager') return;
    
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
      
      let offsetLeft = 0;
      if (sidebarRef.current) {
        offsetLeft = sidebarRef.current.getBoundingClientRect().left;
      }
      
      const relativeX = e.clientX - offsetLeft;
      const newWidth = Math.max(250, Math.min(800, relativeX));
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
    }
  });

  // Memoized thread filtering and sorting - use debounced search to avoid recomputation on every keystroke
  const filteredThreads = useMemo(() => threads.filter(thread => {
    // Skip deleted threads
    if (thread.is_deleted) return false;
    
    // Text search
    let matchesSearch = true;
    if (debouncedSearchFilters.searchText) {
      const searchLower = debouncedSearchFilters.searchText.toLowerCase();
      const subjectMatch = thread.subject?.toLowerCase().includes(searchLower);
      const fromMatch = thread.from_address?.toLowerCase().includes(searchLower);
      const toMatch = thread.to_addresses?.some(addr => addr.toLowerCase().includes(searchLower));
      
      // Search in email body if enabled
      let bodyMatch = false;
      if (debouncedSearchFilters.searchInBody && messages.length > 0) {
        const threadMessages = messages.filter(m => m.thread_id === thread.id);
        bodyMatch = threadMessages.some(m => 
          m.body_text?.toLowerCase().includes(searchLower) ||
          m.body_html?.toLowerCase().includes(searchLower)
        );
      }
      
      matchesSearch = subjectMatch || fromMatch || toMatch || bodyMatch;
    }

    // Sender filter
    const matchesSender = !debouncedSearchFilters.sender || 
      thread.from_address?.toLowerCase().includes(debouncedSearchFilters.sender.toLowerCase());

    // Recipient filter
    const matchesRecipient = !debouncedSearchFilters.recipient ||
      thread.to_addresses?.some(addr => 
        addr.toLowerCase().includes(debouncedSearchFilters.recipient.toLowerCase())
      );

    // Date range filter
    const threadDate = new Date(thread.last_message_date);
    const matchesDateFrom = !debouncedSearchFilters.dateFrom || 
      threadDate >= new Date(debouncedSearchFilters.dateFrom);
    const matchesDateTo = !debouncedSearchFilters.dateTo || 
      threadDate <= new Date(debouncedSearchFilters.dateTo + 'T23:59:59');

    // Attachment filter
    const matchesAttachment = !debouncedSearchFilters.hasAttachment || (() => {
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      return threadMessages.some(m => m.attachments && m.attachments.length > 0);
    })();

    // Attachment name filter
    const matchesAttachmentName = !debouncedSearchFilters.attachmentName || (() => {
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      return threadMessages.some(m => 
        m.attachments && m.attachments.some(att => 
          att.filename?.toLowerCase().includes(debouncedSearchFilters.attachmentName.toLowerCase())
        )
      );
    })();

    // Advanced status filter (from search filters)
    const matchesAdvancedStatus = debouncedSearchFilters.statusFilter === "all" || thread.status === debouncedSearchFilters.statusFilter;

    // "Sent" tab filter - show threads where user sent an email (has outbound messages)
    const matchesSentFilter = statusFilter !== "sent" || (() => {
      // First check if the from_address matches the user (thread was initiated by user)
      const userEmail = user?.gmail_email || user?.email;
      const isFromUser = thread.from_address === userEmail;

      // Also check messages for outbound flag
      const threadMessages = messages.filter(m => m.thread_id === thread.id);
      const hasOutboundMessage = threadMessages.some(m => m.is_outbound === true);

      return isFromUser || hasOutboundMessage;
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
  }), [threads, debouncedSearchFilters, statusFilter, priorityFilter, sortBy, messages, user?.gmail_email, user?.email]);

  const handleStatusChange = useCallback((threadId, newStatus) => {
    updateThreadMutation.mutate({ id: threadId, data: { status: newStatus } });
  }, [updateThreadMutation]);

  const handleLinkProject = useCallback(async (projectId, projectTitle) => {
    try {
      // Check if bulk linking (multiple threads selected)
      if (selectedThreadIds.length > 0) {
        // Bulk link
        toast.info(`Linking ${selectedThreadIds.length} email threads...`);
        
        const results = await Promise.allSettled(
          selectedThreadIds.map(async (threadId) => {
            // Link thread to project
            await base44.functions.invoke('linkEmailThreadToProject', {
              email_thread_id: threadId,
              project_id: projectId,
              set_as_primary: false
            });
            
            // Try to save attachments, but don't fail if it errors
            try {
              await base44.functions.invoke('saveThreadAttachments', {
                thread_id: threadId,
                target_type: 'project',
                target_id: projectId
              });
            } catch (attachError) {
              console.warn('Failed to save attachments for thread', threadId, attachError);
            }
            
            // Mark thread as closed
            await base44.entities.EmailThread.update(threadId, { status: 'Closed' });
          })
        );
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;
        
        if (successCount > 0) {
          toast.success(`${successCount} email thread${successCount !== 1 ? 's' : ''} linked to project`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} email thread${failCount !== 1 ? 's' : ''} failed to link`);
        }
        
        setSelectedThreadIds([]);
      } else if (selectedThread) {
        // Single thread link
        await base44.functions.invoke('linkEmailThreadToProject', {
          email_thread_id: selectedThread.id,
          project_id: projectId,
          set_as_primary: true
        });

        // Auto-save attachments (show progress for single thread)
        toast.info('Processing attachments...');
        try {
          const res = await base44.functions.invoke('saveThreadAttachments', {
            thread_id: selectedThread.id,
            target_type: 'project',
            target_id: projectId
          });
          if (res.data?.saved_count > 0) {
            toast.success(`Saved ${res.data.saved_count} attachments to project`);
          }
        } catch (attachError) {
          console.warn('Failed to save attachments', attachError);
          toast.warning('Thread linked, but attachments could not be saved');
        }

        // Mark thread as closed
        await base44.entities.EmailThread.update(selectedThread.id, { status: 'Closed' });

        toast.success('Email thread linked to project');
      }

      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (error) {
      toast.error('Failed to link email thread');
      console.error('Link error:', error);
    }
    setLinkModalOpen(false);
  }, [selectedThread, selectedThreadIds, queryClient]);

  const handleLinkJob = useCallback((jobId, jobNumber) => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_job_id: jobId, linked_job_number: jobNumber, status: 'Closed' }
    }, {
      onSuccess: () => {
        // Auto-save attachments
        toast.info('Processing attachments...');
        base44.functions.invoke('saveThreadAttachments', {
          thread_id: selectedThread.id,
          target_type: 'job',
          target_id: jobId
        }).then(res => {
          if (res.data?.saved_count > 0) {
            toast.success(`Saved ${res.data.saved_count} attachments to job`);
          }
        }).catch(console.error);
      }
    });
    setLinkModalOpen(false);
  }, [selectedThread, updateThreadMutation]);

  const handleUnlinkProject = useCallback(() => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_project_id: null, linked_project_title: null }
    });
  }, [selectedThread, updateThreadMutation]);

  const handleUnlinkJob = useCallback(() => {
    updateThreadMutation.mutate({
      id: selectedThread.id,
      data: { linked_job_id: null, linked_job_number: null }
    });
  }, [selectedThread, updateThreadMutation]);

  const openLinkModal = useCallback((type) => {
    setLinkType(type);
    setLinkModalOpen(true);
  }, []);

  const handleBulkStatusChange = useCallback(async (status) => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { status })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  }, [selectedThreadIds, queryClient]);

  const handleBulkMarkRead = useCallback(async (isRead) => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { is_read: isRead })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  }, [selectedThreadIds, queryClient]);

  const handleBulkArchive = useCallback(async () => {
    await Promise.all(
      selectedThreadIds.map(id => 
        base44.entities.EmailThread.update(id, { status: "Archived" })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    setSelectedThreadIds([]);
  }, [selectedThreadIds, queryClient]);

  const handleBulkDelete = useCallback(async () => {
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
  }, [selectedThreadIds, queryClient, selectedThread]);

  const handleToggleSelection = useCallback((threadId) => {
    setSelectedThreadIds(prev => 
      prev.includes(threadId) 
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedThreadIds.length === filteredThreads.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(filteredThreads.map(t => t.id));
    }
  }, [selectedThreadIds, filteredThreads]);



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
    <div className="flex h-[calc(100vh-60px)] lg:h-screen bg-[#F9FAFB] overflow-hidden">
      {/* Thread List - Left Side (Gmail-style sidebar) */}
      <div 
        ref={sidebarRef}
        className={`${selectedThread ? 'hidden lg:flex' : 'flex'} flex-col border-r border-[#E5E7EB] bg-white`}
        style={{ width: selectedThread ? `${sidebarWidth}px` : '100%', minWidth: selectedThread ? '320px' : '100%', maxWidth: selectedThread ? '600px' : '100%' }}
      >
        <div className="p-4 md:p-5 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between py-3 lg:py-4 gap-3">
            <GmailConnect 
              user={user} 
              onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['emailThreads'] })} 
            />
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(createPageUrl("EmailSettings"))}>
                    <Settings className="w-4 h-4 mr-2" />
                    Email Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(createPageUrl("EmailTemplates"))}>
                    <FileEdit className="w-4 h-4 mr-2" />
                    Manage Templates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={async () => {
                  const btn = document.activeElement;
                  if (btn) btn.disabled = true;
                  toast.info('Resyncing attachments...');
                  try {
                    const result = await base44.functions.invoke('resyncAttachments', {});
                    if (result.data?.error) {
                      toast.error(`Resync failed: ${result.data.error}`);
                    } else {
                      toast.success(`Resynced: ${result.data?.updated || 0} updated, ${result.data?.skipped || 0} skipped`);
                      queryClient.invalidateQueries({ queryKey: ['allEmailMessages'] });
                    }
                  } catch (error) {
                    const errMsg = error?.response?.data?.error || error?.message || 'Unknown error';
                    toast.error(`Failed to resync: ${errMsg}`);
                    console.error('Resync error:', error);
                  } finally {
                    if (btn) btn.disabled = false;
                  }
                }}
                size="sm"
                variant="outline"
                className="h-9"
                title="Resync attachments for existing emails"
              >
                <Paperclip className="w-4 h-4 mr-1" />
                Resync Attachments
              </Button>
              <Button
                onClick={() => setShowHistorySearch(true)}
                size="sm"
                variant="outline"
                className="h-9"
                title="Search Gmail history"
              >
                <History className="w-4 h-4 mr-1" />
                Search History
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

          {/* Drafts Banner */}
          {drafts.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileEdit className="w-4 h-4 text-amber-600" />
                <span className="text-[13px] font-medium text-amber-800">
                  {drafts.length} Draft{drafts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {drafts.slice(0, 3).map(draft => (
                  <div 
                    key={draft.id}
                    onClick={() => {
                      setEditingDraft(draft);
                      setShowComposer(true);
                    }}
                    className="flex items-center justify-between p-2 bg-white rounded border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#111827] truncate">
                        {draft.subject || '(No subject)'}
                      </p>
                      <p className="text-[12px] text-[#6B7280] truncate">
                        To: {draft.to_addresses?.join(', ') || '(No recipient)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        Draft
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await base44.entities.EmailDraft.delete(draft.id);
                          queryClient.invalidateQueries({ queryKey: ['emailDrafts'] });
                          toast.success('Draft deleted');
                        }}
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {drafts.length > 3 && (
                  <p className="text-[12px] text-amber-600 text-center">
                    +{drafts.length - 3} more draft{drafts.length - 3 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          
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
              onClick={() => {
                setLinkType('project');
                setLinkModalOpen(true);
              }}
              className="h-8 gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Link to Project
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

      {/* Resize Handle (Gmail-style divider) */}
      {selectedThread && (
        <div
          className="hidden lg:block w-1 bg-[#E5E7EB] hover:bg-[#9CA3AF] cursor-col-resize transition-colors relative group flex-shrink-0"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </div>
      )}

      {/* Thread Detail - Right Side (Gmail-style email panel) */}
      {selectedThread && (
        <div className="flex flex-1 flex-col bg-white overflow-hidden">
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
              existingDraft={editingDraft}
              onClose={() => {
                setShowComposer(false);
                setEditingDraft(null);
              }}
              onSent={() => {
                queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
                queryClient.invalidateQueries({ queryKey: ['emailDrafts'] });
                setShowComposer(false);
                setEditingDraft(null);
              }}
              onDraftSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['emailDrafts'] });
              }}
            />
          </div>
        </div>
      )}

      {/* Gmail History Search Modal */}
      <GmailHistorySearch 
        open={showHistorySearch}
        onClose={() => setShowHistorySearch(false)}
      />
      </div>
      );
}