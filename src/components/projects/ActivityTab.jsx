import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MessageSquare, User, Calendar, FileText, Plus, Paperclip } from "lucide-react";
import { format } from "date-fns";
import LogManualActivityModal from "./LogManualActivityModal";
import { Badge } from "@/components/ui/badge";

export default function ActivityTab({ project, onComposeEmail }) {
  const [filter, setFilter] = useState("all");
  const [showLogModal, setShowLogModal] = useState(false);

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
    enabled: !!project.id
  });

  // Fetch email threads for those emails
  const emailThreadIds = [...new Set(projectEmails.map(pe => pe.email_thread_id).filter(Boolean))];
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
            <div className="flex gap-2">
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
                  className="border-l-2 border-[#E5E7EB] pl-4 pb-4 last:pb-0 relative"
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
    </div>
  );
}