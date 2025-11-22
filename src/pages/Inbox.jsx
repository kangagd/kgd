import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Mail, Link as LinkIcon, Check, Archive, Trash2, ArrowUpDown } from "lucide-react";
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

export default function Inbox() {
  const [searchFilters, setSearchFilters] = useState({
    searchText: "",
    sender: "",
    recipient: "",
    dateFrom: "",
    dateTo: "",
    hasAttachment: false,
    searchInBody: true
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
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
    
    const matchesStatus = statusFilter === "all" || thread.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || thread.priority === priorityFilter;
    
    return matchesSearch && matchesSender && matchesRecipient && 
           matchesDateFrom && matchesDateTo && matchesAttachment &&
           matchesStatus && matchesPriority;
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
    await Promise.all(
      selectedThreadIds.map(id => base44.entities.EmailThread.delete(id))
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

  if (!userPermissions?.can_view) {
    return (
      <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
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
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Thread List - Left Side */}
      <div 
        className={`${selectedThread ? 'hidden lg:flex' : 'flex'} flex-col border-r border-[#E5E7EB] bg-white`}
        style={{ width: selectedThread ? `${sidebarWidth}px` : '100%' }}
      >
        <div className="p-5 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[22px] font-semibold text-[#111827]">Inbox</h1>
            <GmailConnect 
              user={user} 
              onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['emailThreads'] })} 
            />
          </div>
          
          <AdvancedSearch
            onSearchChange={setSearchFilters}
            currentFilters={searchFilters}
          />

          <div className="space-y-3">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="w-full grid grid-cols-4 gap-1">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Open">Open</TabsTrigger>
                <TabsTrigger value="In Progress">Active</TabsTrigger>
                <TabsTrigger value="Closed">Closed</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="High">🔴 High</SelectItem>
                  <SelectItem value="Normal">🟡 Normal</SelectItem>
                  <SelectItem value="Low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("date")}>
                    {sortBy === "date" && "✓ "}Date
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("priority")}>
                    {sortBy === "priority" && "✓ "}Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("sender")}>
                    {sortBy === "sender" && "✓ "}Sender
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("subject")}>
                    {sortBy === "subject" && "✓ "}Subject
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("unread")}>
                    {sortBy === "unread" && "✓ "}Unread First
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {selectedThreadIds.length > 0 && (
          <div className="px-5 py-3 bg-[#FAE008]/20 border-b border-[#FAE008]/30 flex items-center gap-3 overflow-x-auto">
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
        )}

        <EmailThreadList
          threads={filteredThreads}
          selectedThread={selectedThread}
          onSelectThread={setSelectedThread}
          isLoading={isLoading}
          selectedThreadIds={selectedThreadIds}
          onToggleSelection={handleToggleSelection}
          onSelectAll={handleSelectAll}
          onBulkDelete={handleBulkDelete}
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
        <div className="flex flex-1 flex-col bg-[#F8F9FA]">
          <EmailDetailView
            thread={selectedThread}
            onClose={() => setSelectedThread(null)}
            onLinkProject={() => openLinkModal('project')}
            onLinkJob={() => openLinkModal('job')}
            onUnlinkProject={handleUnlinkProject}
            onUnlinkJob={handleUnlinkJob}
            userPermissions={userPermissions}
            onDelete={async (threadId) => {
              await base44.entities.EmailThread.delete(threadId);
              queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
              setSelectedThread(null);
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
    </div>
  );
}