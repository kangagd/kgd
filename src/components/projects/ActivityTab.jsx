import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MessageSquare, User, Calendar, Plus, Paperclip, Link2, Unlink, FileEdit, Forward, Reply, Loader2 } from "lucide-react";
import { format } from "date-fns";
import LogManualActivityModal from "./LogManualActivityModal";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import EmailMessageView from "../inbox/EmailMessageView";
import LinkEmailThreadModal from "./LinkEmailThreadModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * ActivityTab: Customer Communication ONLY
 * 
 * SCOPE RULES:
 * ✅ Email threads (via EmailThread.project_id)
 * ✅ Email messages (via EmailMessage)
 * ✅ Email drafts (only if thread is linked)
 * ✅ Manual communication logs (ProjectMessage with type='manual_activity')
 * 
 * ❌ NO system events (quotes, invoices, jobs, POs)
 * ❌ NO operational history (stage changes, completions)
 * ❌ NO change history or audits
 * 
 * System events belong in: ActivityTimeline or Overview tab
 */
export default function ActivityTab({ project, onComposeEmail }) {
  const [filter, setFilter] = useState("all");
  const [showLogModal, setShowLogModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const queryClient = useQueryClient();

  // Fetch manual communication activities only
  // SCOPE: Only manual_activity type - these are customer communications
  // NOT for system events, status changes, or automated logs
  const { data: projectMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['projectMessages', project.id],
    queryFn: async () => {
      const messages = await base44.entities.ProjectMessage.filter({ 
        project_id: project.id,
        message_type: 'manual_activity'
      }, '-created_date');
      
      // Guardrail: warn if any non-communication messages slip through
      messages.forEach(msg => {
        if (msg.message_type !== 'manual_activity') {
          console.warn('[ActivityTab] Non-communication message detected:', msg.id, msg.message_type);
        }
      });
      
      return messages;
    },
    enabled: !!project.id
  });

  // Fetch email threads linked to this project
  // EmailThread.project_id is the ONLY source of truth for email-project linking
  const { data: linkedThreads = [], refetch: refetchThreads } = useQuery({
    queryKey: ['projectEmailThreads', project.id],
    queryFn: async () => {
      const threads = await base44.entities.EmailThread.filter({ 
        project_id: project.id 
      }, '-last_message_date');
      
      // Defensive logging: verify all threads have project_id
      threads.forEach(thread => {
        if (!thread.project_id) {
          console.warn('[ActivityTab] Email thread rendered without project_id link:', thread.id);
        }
      });
      
      return threads;
    },
    enabled: !!project.id,
    refetchOnMount: true
  });

  // Fetch email messages for linked threads
  const { data: emailMessages = [], refetch: refetchEmailMessages } = useQuery({
    queryKey: ['projectEmailMessages', linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      if (linkedThreads.length === 0) return [];
      const allMessages = await Promise.all(
        linkedThreads.map(thread => 
          base44.entities.EmailMessage.filter({ thread_id: thread.id }, '-sent_at')
        )
      );
      return allMessages.flat();
    },
    enabled: linkedThreads.length > 0
  });

  // Fetch draft emails related to linked threads
  // STRICT RULE: ONLY show drafts with thread_id that is linked to this project
  const { data: draftEmails = [] } = useQuery({
    queryKey: ['projectEmailDrafts', linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      // No linked threads = no drafts shown
      if (linkedThreads.length === 0) return [];
      
      const user = await base44.auth.me();
      const allDrafts = await base44.entities.EmailDraft.filter({ 
        created_by: user.email 
      }, '-updated_date');
      
      const threadIds = new Set(linkedThreads.map(t => t.id));
      
      // STRICT FILTER: Draft must have thread_id AND that thread must be linked
      const linkedDrafts = allDrafts.filter(draft => {
        // No thread_id = not shown
        if (!draft.thread_id) {
          return false;
        }
        
        // Thread not linked to project = not shown
        if (!threadIds.has(draft.thread_id)) {
          return false;
        }
        
        return true;
      });
      
      // Defensive logging for any drafts without proper links
      allDrafts.forEach(draft => {
        if (!draft.thread_id) {
          console.log('[ActivityTab] Skipping draft without thread_id:', draft.id);
        } else if (!threadIds.has(draft.thread_id)) {
          console.log('[ActivityTab] Skipping draft with unlinked thread:', draft.id, draft.thread_id);
        }
      });
      
      return linkedDrafts;
    },
    enabled: linkedThreads.length > 0
  });

  // Link email thread mutation
  // This sets EmailThread.project_id as the canonical link
  const linkEmailMutation = useMutation({
    mutationFn: async (threadId) => {
      // Verify thread exists and doesn't already have a project_id
      const thread = await base44.entities.EmailThread.get(threadId);
      
      if (thread.project_id && thread.project_id !== project.id) {
        console.warn('[ActivityTab] Relinking thread from project', thread.project_id, 'to', project.id);
      }
      
      await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: threadId,
        project_id: project.id,
        set_as_primary: linkedThreads.length === 0
      });
    },
    onSuccess: async () => {
      // Immediately refetch to ensure UI updates
      await refetchThreads();
      queryClient.invalidateQueries({ queryKey: ['projectEmailThreads', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      setShowLinkModal(false);
      toast.success('Email thread linked');
    },
    onError: (error) => {
      toast.error(`Failed to link: ${error.message}`);
    }
  });

  // Unlink email thread mutation
  // This removes EmailThread.project_id, the canonical link
  const unlinkEmailMutation = useMutation({
    mutationFn: async (threadId) => {
      console.log('[ActivityTab] Unlinking thread', threadId, 'from project', project.id);
      
      await base44.entities.EmailThread.update(threadId, {
        project_id: null,
        project_number: null,
        project_title: null,
        linked_to_project_at: null,
        linked_to_project_by: null
      });
    },
    onSuccess: async () => {
      // Immediately refetch to ensure UI updates everywhere
      await refetchThreads();
      queryClient.invalidateQueries({ queryKey: ['projectEmailThreads', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success('Email thread unlinked');
    },
    onError: (error) => {
      toast.error(`Failed to unlink: ${error.message}`);
    }
  });

  // Combine communication activities only
  // GUARDRAIL: This is ONLY for customer communication
  // DO NOT add: Quote events, Invoice events, Job events, PO events, Stage changes
  const allActivities = React.useMemo(() => {
    const activities = [];
    
    // ASSERTION: Verify no system entities leaked into this component
    if (typeof quotes !== 'undefined') {
      console.error('[ActivityTab] SCOPE VIOLATION: Quote data detected. Quotes belong in ActivityTimeline.');
    }
    if (typeof jobs !== 'undefined') {
      console.error('[ActivityTab] SCOPE VIOLATION: Job data detected. Jobs belong in ActivityTimeline.');
    }
    if (typeof invoices !== 'undefined') {
      console.error('[ActivityTab] SCOPE VIOLATION: Invoice data detected. Invoices belong in ActivityTimeline.');
    }
    if (typeof changeHistory !== 'undefined') {
      console.error('[ActivityTab] SCOPE VIOLATION: ChangeHistory detected. System history belongs in ActivityTimeline.');
    }

    // Add email messages - ONLY from threads with project_id set
    emailMessages.forEach(msg => {
      const thread = linkedThreads.find(t => t.id === msg.thread_id);
      
      // Defensive check: ensure thread has project_id
      if (!thread || !thread.project_id) {
        console.warn('[ActivityTab] Email message rendered without linked thread:', msg.id, msg.thread_id);
        return;
      }
      
      activities.push({
        id: `email-${msg.id}`,
        type: 'email',
        date: msg.sent_at || msg.created_date,
        from: msg.from_name || msg.from_address,
        subject: msg.subject || thread?.subject,
        content: msg.body_text || msg.body_html,
        attachments: msg.attachments || [],
        isOutbound: msg.is_outbound,
        threadId: msg.thread_id
      });
    });

    // Add draft emails - already filtered to only linked threads in query
    // Double-check: drafts should already be validated, but verify again
    draftEmails.forEach(draft => {
      // Defensive: skip if no thread_id (should never happen due to query filter)
      if (!draft.thread_id) {
        console.error('[ActivityTab] Draft without thread_id in filtered results:', draft.id);
        return;
      }
      
      // Defensive: verify thread is actually linked
      const thread = linkedThreads.find(t => t.id === draft.thread_id);
      if (!thread) {
        console.error('[ActivityTab] Draft thread not found in linked threads:', draft.id, draft.thread_id);
        return;
      }
      
      activities.push({
        id: `draft-${draft.id}`,
        type: 'draft',
        date: draft.updated_date || draft.created_date,
        from: 'Draft',
        subject: draft.subject || '(No subject)',
        content: draft.body_html || draft.body,
        toAddresses: draft.to_addresses || [],
        draftId: draft.id,
        threadId: draft.thread_id,
        mode: draft.mode || 'compose'
      });
    });

    // Add manual activities
    projectMessages.forEach(msg => {
      const typeMatch = msg.content?.match(/^\*\*\[(.+?)\]\*\*/);
      const activityType = typeMatch ? typeMatch[1].toLowerCase() : 'other';
      
      activities.push({
        id: `manual-${msg.id}`,
        type: 'manual',
        subType: activityType,
        date: msg.created_date,
        from: msg.sender_name,
        content: msg.content,
        attachments: msg.attachments || []
      });
    });

    // Final guardrail: verify all activities are communication-related
    const validTypes = new Set(['email', 'draft', 'manual']);
    activities.forEach(activity => {
      if (!validTypes.has(activity.type)) {
        console.error('[ActivityTab] SCOPE VIOLATION: Invalid activity type detected:', activity.type, activity.id);
      }
    });
    
    return activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [emailMessages, projectMessages, linkedThreads, draftEmails]);

  // Filter activities
  const filteredActivities = React.useMemo(() => {
    if (filter === 'all') return allActivities;
    if (filter === 'emails') return allActivities.filter(a => a.type === 'email' || a.type === 'draft');
    if (filter === 'manual') return allActivities.filter(a => a.type === 'manual');
    return allActivities;
  }, [allActivities, filter]);

  const getActivityIcon = (activity) => {
    if (activity.type === 'email' || activity.type === 'draft') return <Mail className="w-4 h-4" />;
    if (activity.subType === 'call') return <Phone className="w-4 h-4" />;
    if (activity.subType === 'sms') return <MessageSquare className="w-4 h-4" />;
    if (activity.subType === 'in-person') return <User className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  const getActivityBadge = (activity) => {
    if (activity.type === 'draft') {
      return <Badge variant="default" className="bg-amber-100 text-amber-700">Draft</Badge>;
    }
    if (activity.type === 'email') {
      return activity.isOutbound ? (
        <Badge variant="default" className="bg-blue-100 text-blue-700">Sent</Badge>
      ) : (
        <Badge variant="default" className="bg-green-100 text-green-700">Received</Badge>
      );
    }
    return (
      <Badge variant="secondary" className="capitalize">{activity.subType}</Badge>
    );
  };

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Customer Communication</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setShowLinkModal(true)}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Link2 className="w-4 h-4" />
                Link Email
              </Button>
              <Button
                onClick={() => onComposeEmail?.()}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Compose Email
              </Button>
              <Button
                onClick={() => setShowLogModal(true)}
                size="sm"
                className="gap-2 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                <Plus className="w-4 h-4" />
                Log Activity
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="emails" className="flex-1">Emails</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Communication Timeline */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardContent className="p-4">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF]">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
              <p className="text-[14px]">No communication logged yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-2 border-[#E5E7EB] pl-4 pb-4 last:pb-0 relative ${(activity.type === 'email' || activity.type === 'draft') ? 'cursor-pointer hover:bg-[#F9FAFB] -mx-4 px-8 py-2 rounded-lg transition-colors' : ''}`}
                  onClick={() => {
                    if (activity.type === 'email') {
                      setSelectedActivity(activity);
                    } else if (activity.type === 'draft') {
                      onComposeEmail?.(activity);
                    }
                  }}
                >
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#E5E7EB] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[#6B7280]">
                        {getActivityIcon(activity)}
                      </div>
                      <span className="font-medium text-[14px] text-[#111827]">
                        {activity.from}
                      </span>
                      {getActivityBadge(activity)}
                    </div>
                    <span className="text-[12px] text-[#9CA3AF]">
                      {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  {activity.subject && (
                    <div className="font-medium text-[13px] text-[#4B5563] mb-1">
                      {activity.subject}
                    </div>
                  )}

                  {activity.content && (
                    <div 
                      className="text-[13px] text-[#6B7280] line-clamp-3"
                      dangerouslySetInnerHTML={{ 
                        __html: activity.type === 'email' || activity.type === 'draft'
                          ? stripHtml(activity.content).substring(0, 200) + '...'
                          : activity.content.replace(/\*\*/g, '').substring(0, 200)
                      }}
                    />
                  )}
                  
                  {activity.type === 'draft' && activity.toAddresses?.length > 0 && (
                    <div className="text-[12px] text-[#9CA3AF] mt-1 flex items-center gap-1">
                      <FileEdit className="w-3 h-3" />
                      <span>To: {activity.toAddresses.join(', ')}</span>
                    </div>
                  )}

                  {activity.attachments?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-[12px] text-[#9CA3AF]">
                      <Paperclip className="w-3 h-3" />
                      <span>{activity.attachments.length} attachment{activity.attachments.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LogManualActivityModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        projectId={project.id}
        onSuccess={refetchMessages}
      />

      <EmailThreadViewerModal
        selectedActivity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        emailMessages={emailMessages}
        linkedThreads={linkedThreads}
        project={project}
        unlinkEmailMutation={unlinkEmailMutation}
        onComposeEmail={onComposeEmail}
      />

      <LinkEmailThreadModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        projectId={project.id}
        onLink={(threadId) => linkEmailMutation.mutate(threadId)}
        isLinking={linkEmailMutation.isPending}
      />
    </div>
  );
}

// Separate Email Thread Viewer Modal Component
function EmailThreadViewerModal({ 
  selectedActivity, 
  onClose, 
  emailMessages, 
  linkedThreads, 
  project, 
  unlinkEmailMutation, 
  onComposeEmail 
}) {
  const messagesEndRef = useRef(null);
  const threadId = selectedActivity?.threadId;
  
  // B) Dedicated query for the selected thread (more reliable than linkedThreads)
  const { data: threadById, isLoading: threadLoading } = useQuery({
    queryKey: ['emailThreadById', threadId],
    queryFn: async () => {
      return await base44.entities.EmailThread.get(threadId);
    },
    enabled: !!threadId
  });

  // A) Fix message ordering: ascending (oldest → newest)
  const threadMessages = React.useMemo(() => {
    if (!threadId) return [];
    return emailMessages
      .filter(msg => msg.thread_id === threadId)
      .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at)); // oldest → newest
  }, [threadId, emailMessages]);

  // Use linkedThreads as primary source (working data), fall back to threadById for display
  const threadFromList = linkedThreads.find(t => t.id === threadId);
  const thread = threadFromList || threadById || null;
  
  // D) Safety: define latestMessage and canCompose
  const latestMessage = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;
  const canCompose = !!threadFromList && !!latestMessage;

  // E) Auto-scroll to latest message on open
  useEffect(() => {
    if (threadMessages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [threadId, threadMessages.length]);

  const handleReply = () => {
    if (!canCompose) {
      toast.error('No message available to reply to.');
      return;
    }
    onClose();
    onComposeEmail?.({
      mode: 'reply',
      thread: threadFromList,
      message: latestMessage
    });
  };

  const handleForward = () => {
    if (!canCompose) {
      toast.error('No message available to forward.');
      return;
    }
    onClose();
    onComposeEmail?.({
      mode: 'forward',
      thread: threadFromList,
      message: latestMessage
    });
  };

  const handleUnlink = () => {
    if (threadId) {
      unlinkEmailMutation.mutate(threadId);
      onClose();
    }
  };

  return (
    <Dialog open={!!selectedActivity && selectedActivity?.type === 'email'} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {selectedActivity?.type === 'email' && (
          <>
            {/* C) Sticky Header with actions */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* F) Loading state */}
                  {threadLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                      <span className="text-[14px] text-[#6B7280]">Loading thread...</span>
                    </div>
                  ) : (
                    <>
                      <DialogTitle className="flex items-center gap-2 text-[16px]">
                        <Mail className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{thread?.subject || selectedActivity?.subject || 'Email Thread'}</span>
                      </DialogTitle>
                      <DialogDescription className="text-[13px] text-[#6B7280] mt-1">
                        {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''} in this thread
                      </DialogDescription>
                    </>
                  )}
                </div>
                
                {/* C) Action buttons in header (no absolute positioning) */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={unlinkEmailMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Unlink email from project"
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForward}
                    disabled={!canCompose}
                    className="gap-1"
                  >
                    <Forward className="w-4 h-4" />
                    Forward
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={!canCompose}
                    className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-1"
                  >
                    <Reply className="w-4 h-4" />
                    Reply
                  </Button>
                </div>
              </div>
            </div>

            {/* Message list - scrollable area */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* F) Empty state */}
              {!threadLoading && threadMessages.length === 0 ? (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                  <p className="text-[14px]">No messages found for this thread.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {threadMessages.map((msg, idx) => (
                    <EmailMessageView
                      key={msg.id}
                      message={msg}
                      isFirst={idx === 0}  // A) Fix: oldest message gets isFirst
                      linkedProjectId={project.id}
                      threadSubject={thread?.subject}
                      gmailMessageId={msg.gmail_message_id}
                      onReply={(message) => {
                        if (!message || !threadFromList) {
                          toast.error('No message available to reply to.');
                          return;
                        }
                        onClose();
                        onComposeEmail?.({
                          mode: 'reply',
                          thread: threadFromList,
                          message: message
                        });
                      }}
                      onForward={(message) => {
                        if (!message || !threadFromList) {
                          toast.error('No message available to forward.');
                          return;
                        }
                        onClose();
                        onComposeEmail?.({
                          mode: 'forward',
                          thread: threadFromList,
                          message: message
                        });
                      }}
                      thread={threadFromList}
                    />
                  ))}
                  {/* E) Auto-scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}