import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Reply,
  Forward,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  Link as LinkIcon,
  X,
  Trash2,
  UserPlus,
  User,
  Zap
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import EmailComposer from "./EmailComposer";
import AttachmentCard from "./AttachmentCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailMessageItem from "./EmailMessageItem";
import AIThreadSuggestionBanner from "./AIThreadSuggestionBanner";

import EmailAIInsightsPanel from "./EmailAIInsightsPanel";
import CreateProjectFromEmailModal from "./CreateProjectFromEmailModal";
import CreateJobFromEmailModal from "./CreateJobFromEmailModal";
import AssignThreadModal from "./AssignThreadModal";
import InternalNotesPanel from "./InternalNotesPanel";
import PresenceIndicator from "./PresenceIndicator";

export default function EmailDetailView({
  thread,
  onClose,
  onLinkProject,
  onLinkJob,
  onUnlinkProject,
  onUnlinkJob,
  userPermissions,
  onDelete,
  onThreadUpdate
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [composerMode, setComposerMode] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showFullHeader, setShowFullHeader] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [aiThread, setAiThread] = useState(thread);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Track presence - update viewer record
  const updatePresenceMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      // Find existing viewer record
      const existing = await base44.entities.EmailThreadViewer.filter({
        thread_id: thread.id,
        user_email: user.email
      });

      if (existing.length > 0) {
        // Update existing
        await base44.entities.EmailThreadViewer.update(existing[0].id, {
          last_seen: new Date().toISOString()
        });
      } else {
        // Create new
        await base44.entities.EmailThreadViewer.create({
          thread_id: thread.id,
          user_email: user.email,
          user_name: user.full_name || user.display_name,
          last_seen: new Date().toISOString()
        });
      }
    }
  });

  // Update presence on mount and every 30 seconds
  useEffect(() => {
    if (!user || !thread.id) return;

    updatePresenceMutation.mutate();
    const interval = setInterval(() => {
      updatePresenceMutation.mutate();
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.email, thread.id]);

  // Cleanup viewer on unmount
  useEffect(() => {
    return () => {
      if (!user || !thread.id) return;
      
      base44.entities.EmailThreadViewer.filter({
        thread_id: thread.id,
        user_email: user.email
      }).then(existing => {
        if (existing.length > 0) {
          base44.entities.EmailThreadViewer.delete(existing[0].id).catch(() => {});
        }
      }).catch(() => {});
    };
  }, []);

  // Fetch thread viewers for presence
  const { data: viewers = [] } = useQuery({
    queryKey: ['thread-viewers', thread.id],
    queryFn: () => base44.entities.EmailThreadViewer.filter({ thread_id: thread.id }),
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !!user
  });

  // Update aiThread when thread prop changes
  React.useEffect(() => {
    setAiThread(thread);
  }, [thread?.id]);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['emailMessages', thread.id, thread.gmail_thread_id],
    queryFn: async () => {
      // Fetch by both Base44 thread ID and gmail_thread_id, then dedupe
      const [byBase44Id, byGmailId] = await Promise.all([
        base44.entities.EmailMessage.filter({ thread_id: thread.id }, 'sent_at'),
        thread.gmail_thread_id 
          ? base44.entities.EmailMessage.filter({ thread_id: thread.gmail_thread_id }, 'sent_at')
          : Promise.resolve([])
      ]);
      
      // Dedupe by message id
      const msgMap = new Map();
      [...byBase44Id, ...byGmailId].forEach(m => msgMap.set(m.id, m));
      return Array.from(msgMap.values()).sort((a, b) => 
        new Date(a.sent_at) - new Date(b.sent_at)
      );
    },
    refetchInterval: 30000
  });

  // Verify linked project exists (use project_id field)
  const { data: linkedProject } = useQuery({
    queryKey: ['project', thread.project_id],
    queryFn: async () => {
      if (!thread.project_id) return null;
      try {
        const project = await base44.entities.Project.get(thread.project_id);
        if (project.deleted_at) return null;
        return project;
      } catch {
        return null;
      }
    },
    enabled: !!thread.project_id
  });

  const latestMessage = messages[messages.length - 1];
  const allAttachments = messages.flatMap(m => m.attachments || []);



  const handleReply = () => {
    if (!latestMessage) return;
    setSelectedMessage(latestMessage);
    setComposerMode("reply");
  };

  const handleForward = () => {
    if (!latestMessage) return;
    setSelectedMessage(latestMessage);
    setComposerMode("forward");
  };

  const handleCloseComposer = () => {
    setComposerMode(null);
    setSelectedMessage(null);
  };

  const handleEmailSent = async (baseThreadId) => {
    // baseThreadId is the Base44 EmailThread.id returned from gmailSendEmail
    
    // Invalidate thread and message queries
    queryClient.invalidateQueries({ queryKey: ['emailMessages', baseThreadId || thread.id] });
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    
    // Refetch current thread to show new message
    await refetch();
    
    // Update parent if callback exists
    if (onThreadUpdate) {
      onThreadUpdate();
    }
    
    // Close composer
    setComposerMode(null);
    setSelectedMessage(null);
  };

  const handleThreadUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    if (onThreadUpdate) {
      onThreadUpdate();
    }
  };



  const getSenderInitials = (name, email) => {
    if (name && typeof name === 'string') {
      const parts = name.trim().split(' ').filter(Boolean);
      if (parts.length > 1 && parts[0][0] && parts[1][0]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      if (parts.length > 0 && parts[0][0]) {
        return parts[0][0].toUpperCase();
      }
    }
    if (email && typeof email === 'string' && email[0]) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      {/* Centered Content Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
          {/* AI Suggestion Banner - non-blocking */}
           <AIThreadSuggestionBanner
             thread={aiThread}
             onDismiss={async () => {
               await base44.entities.EmailThread.update(thread.id, {
                 ai_suggestion_dismissed_at: new Date().toISOString()
               });
               setAiThread(prev => ({ ...prev, ai_suggestion_dismissed_at: new Date().toISOString() }));
             }}
             onCreateProject={() => setShowCreateProjectModal(true)}
             onCreateJob={() => setShowCreateJobModal(true)}
             onLinkProject={() => {
               // TODO: implement link to suggested project or open link modal
             }}
           />

          {/* Presence Indicator */}
           {viewers.length > 1 && (
             <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
               <div className="flex items-center gap-2">
                 <PresenceIndicator viewers={viewers} currentUserEmail={user?.email} />
                 <span className="text-sm text-blue-700">
                   {viewers.filter(v => v.user_email !== user?.email).length === 1 
                     ? 'Someone else is viewing this email' 
                     : `${viewers.filter(v => v.user_email !== user?.email).length} others are viewing this email`}
                 </span>
               </div>
             </div>
           )}

          {/* Assignment & Activity Info */}
          {(thread.assigned_to || thread.last_worked_by) && (
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4 mb-6 space-y-2">
              {thread.assigned_to && (
                <div className="flex items-center gap-2 text-sm">
                  <UserPlus className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#6B7280]">Assigned to:</span>
                  <span className="font-medium text-[#111827]">{thread.assigned_to_name}</span>
                  {thread.assigned_at && (
                    <span className="text-xs text-[#9CA3AF]">
                      ({format(parseISO(thread.assigned_at), 'MMM d, h:mm a')})
                    </span>
                  )}
                </div>
              )}
              {thread.last_worked_by && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#6B7280]">Last worked by:</span>
                  <span className="font-medium text-[#111827]">{thread.last_worked_by_name}</span>
                  {thread.last_worked_at && (
                    <span className="text-xs text-[#9CA3AF]">
                      ({format(parseISO(thread.last_worked_at), 'MMM d, h:mm a')})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Internal Notes - Collapsible */}
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="flex items-center gap-2 px-4 py-3 mb-4 w-full hover:bg-[#F9FAFB] rounded-lg transition-colors border border-[#E5E7EB] text-[14px] font-medium text-[#111827]"
          >
            <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${notesExpanded ? 'rotate-180' : ''}`} />
            Internal Notes
          </button>
          {notesExpanded && (
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 mb-6">
              <InternalNotesPanel threadId={thread.id} />
            </div>
          )}

          {/* AI Insights Panel - Collapsible */}
          <button
            onClick={() => setAiInsightsExpanded(!aiInsightsExpanded)}
            className="flex items-center gap-2 px-4 py-3 mb-4 w-full hover:bg-[#F9FAFB] rounded-lg transition-colors border border-[#E5E7EB] text-[14px] font-medium text-[#111827]"
          >
            <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${aiInsightsExpanded ? 'rotate-180' : ''}`} />
            AI Insights
          </button>
          {aiInsightsExpanded && (
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 mb-6">
              <EmailAIInsightsPanel
                thread={aiThread}
                onThreadUpdated={(updated) => {
                  setAiThread(updated);
                  handleThreadUpdate();
                }}
                onCreateProjectFromAI={() => setShowCreateProjectModal(true)}
                onCreateJobFromAI={() => setShowCreateJobModal(true)}
              />
            </div>
          )}

          {/* Main Email Card */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden mb-6">
            {/* Header - Subject & Actions */}
            <div className="p-6 border-b border-[#E5E7EB]">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] leading-tight mb-2">
                    {thread.subject}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#6B7280]">
                  {linkedProject && (
                  <div className="flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    <span>Project:</span>
                    <button
                      onClick={() => navigate(createPageUrl("Projects") + `?projectId=${linkedProject.id}`)}
                      className="text-[#111827] font-medium hover:underline"
                    >
                      {linkedProject.title}
                    </button>
                  </div>
                  )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Email Actions - Reply, Forward, Delete */}
                  {userPermissions?.can_reply && (
                    <div className="flex items-center gap-1 pr-3 border-r border-[#E5E7EB]">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReply}
                        title="Reply"
                        className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Reply className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleForward}
                        title="Forward"
                        className="h-9 w-9 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Forward className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this email thread?')) {
                            onDelete?.(thread.id);
                          }
                        }}
                        title="Delete"
                        className="h-9 w-9 hover:text-[#DC2626] hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Work Actions - Link, Assign, AI */}
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-amber-50 hover:text-amber-600" title="Work actions">
                          <Zap className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {userPermissions?.can_link_to_project && (
                          <DropdownMenuItem onClick={onLinkProject}>
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Link to Project
                          </DropdownMenuItem>
                        )}
                        {thread.project_id && userPermissions?.can_link_to_project && (
                          <DropdownMenuItem onClick={onUnlinkProject}>
                            <X className="w-4 h-4 mr-2" />
                            Unlink Project
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {userPermissions?.can_create_project_from_email && (
                          <DropdownMenuItem onClick={() => setShowCreateProjectModal(true)}>
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Create Project
                          </DropdownMenuItem>
                        )}
                        {userPermissions?.can_create_job_from_email && (
                          <DropdownMenuItem onClick={() => setShowCreateJobModal(true)}>
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Create Job
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowAssignModal(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          {thread.assigned_to ? `Reassign (${thread.assigned_to_name})` : 'Assign Owner'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 lg:hidden"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Email Metadata Row */}
              {latestMessage && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FAE008] flex items-center justify-center text-[#111827] font-semibold flex-shrink-0">
                    {getSenderInitials(latestMessage.from_name, latestMessage.from_address)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-[#111827]">
                        {latestMessage.from_name || latestMessage.from_address}
                      </span>
                      <span className="text-[13px] text-[#6B7280]">
                        &lt;{latestMessage.from_address}&gt;
                      </span>
                    </div>
                    <div className="text-[13px] text-[#6B7280] mt-1">
                      to {latestMessage.to_addresses?.join(', ') || thread.to_addresses?.join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[13px] text-[#6B7280]">
                      {latestMessage.sent_at && format(parseISO(latestMessage.sent_at), 'MMM d, h:mm a')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowFullHeader(!showFullHeader)}
                      className="h-6 w-6"
                    >
                      {showFullHeader ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Expanded Header Details */}
              {showFullHeader && latestMessage && (
                <div className="mt-4 pt-4 border-t border-[#F3F4F6] space-y-2 text-[13px]">
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">From:</span>
                    <span className="text-[#111827]">{latestMessage.from_address}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">To:</span>
                    <span className="text-[#111827]">{latestMessage.to_addresses?.join(', ')}</span>
                  </div>
                  {latestMessage.cc_addresses?.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-[#6B7280] font-medium min-w-[60px]">Cc:</span>
                      <span className="text-[#111827]">{latestMessage.cc_addresses.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">Date:</span>
                    <span className="text-[#111827]">
                      {latestMessage.sent_at && format(parseISO(latestMessage.sent_at), 'EEEE, MMMM d, yyyy at h:mm a')}
                    </span>
                  </div>
                  {latestMessage.message_id && (
                    <div className="flex gap-2">
                      <span className="text-[#6B7280] font-medium min-w-[60px]">Message ID:</span>
                      <span className="text-[#111827] break-all font-mono text-[11px]">{latestMessage.message_id}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email Composer */}
            {composerMode && (
              <div className="px-6 py-4 border-b border-[#F3F4F6] bg-[#FAFBFC]">
                <EmailComposer
                  mode={composerMode}
                  thread={thread}
                  message={selectedMessage}
                  onClose={handleCloseComposer}
                  onSent={handleEmailSent}
                />
              </div>
            )}

            {/* Attachments Section - Collapsed by default */}
             {allAttachments.length > 0 && (
               <>
                 <button
                   onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                   className="flex items-center gap-2 px-6 py-4 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors w-full text-[14px] font-medium text-[#111827]"
                 >
                   <Paperclip className="w-4 h-4 text-[#6B7280]" />
                   Attachments ({allAttachments.length})
                   <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ml-auto ${attachmentsExpanded ? 'rotate-180' : ''}`} />
                 </button>
                 {attachmentsExpanded && (
                   <div className="px-6 py-4 border-b border-[#E5E7EB]">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {allAttachments.map((attachment, idx) => (
                         <AttachmentCard
                           key={idx}
                           attachment={attachment}
                           linkedProjectId={thread.project_id}
                           threadSubject={thread.subject}
                           gmailMessageId={attachment.gmail_message_id}
                         />
                       ))}
                     </div>
                   </div>
                 )}
               </>
             )}

            {/* Message List - Scrollable */}
            <div className="divide-y divide-[#E5E7EB]">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <EmailMessageItem
                    key={msg.id}
                    message={msg}
                    isLast={idx === messages.length - 1}
                    totalMessages={messages.length}
                    getSenderInitials={getSenderInitials}
                  />
                ))
              ) : (
                <div className="text-[14px] text-[#6B7280] text-center py-8">
                  No messages in this thread
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewAttachment?.filename}</span>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a href={previewAttachment?.url} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
                </a>
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewAttachment?.mime_type?.startsWith('image/') && (
            <img
              src={previewAttachment.url}
              alt={previewAttachment.filename}
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Project From Email Modal */}
      {showCreateProjectModal && (
        <CreateProjectFromEmailModal
          open={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          thread={aiThread}
          onSuccess={(projectId, projectTitle) => {
            toast.success('Project created successfully');
            setShowCreateProjectModal(false);
            handleThreadUpdate();
          }}
        />
      )}

      {/* Create Job From Email Modal */}
      {showCreateJobModal && (
        <CreateJobFromEmailModal
          open={showCreateJobModal}
          onClose={() => setShowCreateJobModal(false)}
          thread={aiThread}
          onSuccess={(jobId, jobNumber) => {
            toast.success('Job created successfully');
            setShowCreateJobModal(false);
            handleThreadUpdate();
          }}
        />
      )}

      {/* Assign Thread Modal */}
      {showAssignModal && (
        <AssignThreadModal
          thread={thread}
          open={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            handleThreadUpdate();
          }}
        />
      )}
    </div>
  );
}