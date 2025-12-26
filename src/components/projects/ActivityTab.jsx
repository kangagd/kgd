import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MessageSquare, User, Calendar, FileText, Plus, Paperclip, Link2, X } from "lucide-react";
import { format } from "date-fns";
import LogManualActivityModal from "./LogManualActivityModal";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ActivityTab({ project, onComposeEmail }) {
  const [filter, setFilter] = useState("all");
  const [showLogModal, setShowLogModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const queryClient = useQueryClient();

  // Fetch project messages (manual activities)
  const { data: projectMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['projectMessages', project.id],
    queryFn: () => base44.entities.ProjectMessage.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  // Fetch project emails
  const { data: projectEmails = [] } = useQuery({
    queryKey: ['projectEmails', project.id],
    queryFn: () => base44.entities.ProjectEmail.filter({ project_id: project.id }),
    enabled: !!project.id,
    refetchOnMount: true
  });

  // Fetch all email threads for linking (last 6 months)
  const { data: allEmailThreads = [] } = useQuery({
    queryKey: ['allEmailThreads'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const threads = await base44.entities.EmailThread.list('-created_date', 500);
      
      // Filter by date and exclude automatic replies
      return threads.filter(thread => {
        const threadDate = new Date(thread.last_message_date || thread.created_date);
        if (threadDate < sixMonthsAgo) return false;
        
        // Exclude automatic replies
        const subject = (thread.subject || '').toLowerCase();
        const autoReplyPatterns = [
          'auto-reply',
          'automatic reply',
          'out of office',
          'out of the office',
          'away from office',
          'delivery status notification',
          'undeliverable',
          'mail delivery failed',
          'returned mail',
          'auto response',
          'vacation reply',
          'absence notification'
        ];
        
        return !autoReplyPatterns.some(pattern => subject.includes(pattern));
      });
    },
    enabled: showLinkModal
  });

  // Filter email threads based on search
  const filteredEmailThreads = React.useMemo(() => {
    if (!searchTerm) return allEmailThreads.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return allEmailThreads.filter(thread =>
      thread.subject?.toLowerCase().includes(term) ||
      thread.from_address?.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [allEmailThreads, searchTerm]);

  // Link email thread mutation
  const linkEmailMutation = useMutation({
    mutationFn: async (thread) => {
      // Fetch the first message from this thread to get gmail_message_id
      const messages = await base44.entities.EmailMessage.filter({ thread_id: thread.id });
      if (messages.length === 0) {
        throw new Error("No messages found in this thread");
      }
      
      const firstMessage = messages[0];
      
      await base44.entities.ProjectEmail.create({
        project_id: project.id,
        gmail_message_id: firstMessage.gmail_message_id,
        thread_id: thread.id,
        subject: thread.subject,
        snippet: thread.last_message_snippet,
        from_email: thread.from_address,
        sent_at: thread.last_message_date,
        is_historical: true
      });
    },
    onSuccess: async () => {
      // Force immediate refetch
      await queryClient.refetchQueries({ 
        queryKey: ['projectEmails', project.id],
        type: 'active'
      });
      setShowLinkModal(false);
      setSearchTerm("");
      toast.success("Email thread linked to project");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to link email thread");
    }
  });

  // Unlink email thread mutation
  const unlinkEmailMutation = useMutation({
    mutationFn: async (threadId) => {
      const projectEmail = projectEmails.find(pe => pe.thread_id === threadId);
      if (projectEmail) {
        await base44.entities.ProjectEmail.delete(projectEmail.id);
      }
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ['projectEmails', project.id],
        type: 'active'
      });
      toast.success("Email thread unlinked");
    },
    onError: () => {
      toast.error("Failed to unlink email thread");
    }
  });

  // Fetch email threads for those emails
  const emailThreadIds = [...new Set(projectEmails.map(pe => pe.thread_id).filter(Boolean))];
  const { data: emailThreads = [] } = useQuery({
    queryKey: ['emailThreads', emailThreadIds],
    queryFn: async () => {
      if (emailThreadIds.length === 0) return [];
      const threads = await Promise.all(
        emailThreadIds.map(id => base44.entities.EmailThread.get(id).catch(() => null))
      );
      return threads.filter(Boolean);
    },
    enabled: emailThreadIds.length > 0
  });

  // Fetch email messages for those threads
  const { data: emailMessages = [] } = useQuery({
    queryKey: ['emailMessages', emailThreadIds],
    queryFn: async () => {
      if (emailThreadIds.length === 0) return [];
      const messages = await Promise.all(
        emailThreadIds.map(threadId => 
          base44.entities.EmailMessage.filter({ thread_id: threadId })
        )
      );
      return messages.flat();
    },
    enabled: emailThreadIds.length > 0
  });

  // Combine all activities
  const allActivities = React.useMemo(() => {
    const activities = [];

    // Add email activities
    emailMessages.forEach(msg => {
      const thread = emailThreads.find(t => t.id === msg.thread_id);
      activities.push({
        id: `email-${msg.id}`,
        type: 'email',
        date: msg.sent_at || msg.created_date,
        from: msg.from_name || msg.from_address,
        subject: msg.subject || thread?.subject,
        content: msg.body_text || msg.body_html,
        attachments: msg.attachments || [],
        isOutbound: msg.is_outbound
      });
    });

    // Add manual activities
    projectMessages
      .filter(msg => msg.message_type === 'manual_activity')
      .forEach(msg => {
        // Parse activity type from content
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

    // Sort by date, newest first
    return activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [emailMessages, projectMessages, emailThreads]);

  // Filter activities
  const filteredActivities = React.useMemo(() => {
    if (filter === 'all') return allActivities;
    if (filter === 'emails') return allActivities.filter(a => a.type === 'email');
    if (filter === 'manual') return allActivities.filter(a => a.type === 'manual');
    return allActivities;
  }, [allActivities, filter]);

  const getActivityIcon = (activity) => {
    if (activity.type === 'email') return <Mail className="w-4 h-4" />;
    if (activity.subType === 'call') return <Phone className="w-4 h-4" />;
    if (activity.subType === 'sms') return <MessageSquare className="w-4 h-4" />;
    if (activity.subType === 'in-person') return <User className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  const getActivityBadge = (activity) => {
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
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Activity Timeline</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLinkModal(true);
                }}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Link2 className="w-4 h-4" />
                Link Email
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onComposeEmail?.();
                }}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Compose Email
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLogModal(true);
                }}
                size="sm"
                className="gap-2 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                <Plus className="w-4 h-4" />
                Log Manual Update
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

      {/* Timeline */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardContent className="p-4">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF]">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
              <p className="text-[14px]">No activities logged yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-2 border-[#E5E7EB] pl-4 pb-4 last:pb-0 relative ${activity.type === 'email' ? 'cursor-pointer hover:bg-[#F9FAFB] -mx-4 px-8 py-2 rounded-lg transition-colors' : ''}`}
                  onClick={() => activity.type === 'email' && setSelectedActivity(activity)}
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
                        __html: activity.type === 'email' 
                          ? stripHtml(activity.content).substring(0, 200) + '...'
                          : activity.content.replace(/\*\*/g, '').substring(0, 200)
                      }}
                    />
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

      <Dialog open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {selectedActivity?.subject || 'Email'}
            </DialogTitle>
            <DialogDescription>
              {selectedActivity && (
                <div className="flex items-center gap-2 text-[13px]">
                  <span>From: {selectedActivity.from}</span>
                  <span>•</span>
                  <span>{format(new Date(selectedActivity.date), 'MMM d, yyyy h:mm a')}</span>
                  {selectedActivity.isOutbound && (
                    <Badge variant="default" className="bg-blue-100 text-blue-700 ml-2">Sent</Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {selectedActivity?.attachments?.length > 0 && (
              <div className="mb-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#4B5563] mb-2">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({selectedActivity.attachments.length})
                </div>
                <div className="space-y-1">
                  {selectedActivity.attachments.map((att, idx) => (
                    <div key={idx} className="text-[13px] text-[#6B7280]">
                      {att.filename || `Attachment ${idx + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedActivity?.content && (
              <div 
                className="gmail-email-body prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: selectedActivity.content 
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Link Email Thread to Project</DialogTitle>
            <DialogDescription>
              Search and select an email thread to link to this project
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Input
              placeholder="Search by subject or sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredEmailThreads.length === 0 ? (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                  <p className="text-[14px]">No email threads found</p>
                </div>
              ) : (
                filteredEmailThreads.map((thread) => {
                  const alreadyLinked = projectEmails.some(pe => pe.thread_id === thread.id);
                  
                  return (
                    <button
                      key={thread.id}
                      onClick={() => {
                        if (!alreadyLinked) {
                          linkEmailMutation.mutate(thread);
                        }
                      }}
                      disabled={alreadyLinked || linkEmailMutation.isPending}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        alreadyLinked 
                          ? 'bg-[#F3F4F6] border-[#E5E7EB] cursor-not-allowed opacity-50' 
                          : 'bg-white border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[14px] text-[#111827] mb-1 truncate">
                            {thread.subject || '(No subject)'}
                          </div>
                          <div className="text-[13px] text-[#6B7280] mb-1 truncate">
                            From: {thread.from_address}
                          </div>
                          {thread.last_message_snippet && (
                            <div className="text-[12px] text-[#9CA3AF] line-clamp-2">
                              {thread.last_message_snippet}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {alreadyLinked ? (
                            <>
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                Linked
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unlinkEmailMutation.mutate(thread.id);
                                }}
                                disabled={unlinkEmailMutation.isPending}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[12px] text-[#9CA3AF]">
                              {format(new Date(thread.last_message_date), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}