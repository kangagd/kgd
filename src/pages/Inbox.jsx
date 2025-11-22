import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Mail, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailThreadList from "../components/inbox/EmailThreadList";
import EmailThreadDetail from "../components/inbox/EmailThreadDetail";
import LinkThreadModal from "../components/inbox/LinkThreadModal";
import CreateProjectFromEmailModal from "../components/inbox/CreateProjectFromEmailModal";
import CreateJobFromEmailModal from "../components/inbox/CreateJobFromEmailModal";
import GmailConnect from "../components/inbox/GmailConnect";

export default function Inbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedThread, setSelectedThread] = useState(null);
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
    const matchesSearch = 
      thread.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.from_address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || thread.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="w-full grid grid-cols-4 gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Open">Open</TabsTrigger>
              <TabsTrigger value="In Progress">Active</TabsTrigger>
              <TabsTrigger value="Closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <EmailThreadList
          threads={filteredThreads}
          selectedThread={selectedThread}
          onSelectThread={setSelectedThread}
          isLoading={isLoading}
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
      <div className={`${selectedThread ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-[#F8F9FA]`}>
        {selectedThread ? (
          <EmailThreadDetail
            thread={selectedThread}
            onClose={() => setSelectedThread(null)}
            onStatusChange={handleStatusChange}
            onLinkProject={() => openLinkModal('project')}
            onLinkJob={() => openLinkModal('job')}
            onUnlinkProject={handleUnlinkProject}
            onUnlinkJob={handleUnlinkJob}
            onCreateProject={() => setCreateProjectModalOpen(true)}
            onCreateJob={() => setCreateJobModalOpen(true)}
            userPermissions={userPermissions}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto text-[#D1D5DB] mb-4" />
              <p className="text-[14px] text-[#4B5563]">Select an email to view</p>
            </div>
          </div>
        )}
      </div>

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