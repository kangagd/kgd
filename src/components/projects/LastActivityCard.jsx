import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity, Mail, MessageCircle, FileText } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { buildUnifiedThread } from "@/components/domain/threadAdapter";
import { Badge } from "@/components/ui/badge";

export default function LastActivityCard({ project }) {
  // Fetch all thread data sources
  const { data: projectMessages = [] } = useQuery({
    queryKey: ['projectMessages', project.id],
    queryFn: () => base44.entities.ProjectMessage?.filter({ project_id: project.id }, '-created_date') || [],
    enabled: !!project.id
  });

  const { data: projectEmails = [] } = useQuery({
    queryKey: ['projectEmails', project.id],
    queryFn: () => base44.entities.ProjectEmail?.filter({ project_id: project.id }, '-created_date') || [],
    enabled: !!project.id
  });

  const { data: emailThreads = [] } = useQuery({
    queryKey: ['emailThreadsForProject', project.id],
    queryFn: async () => {
      // Get all threads linked to this project via ProjectEmail
      if (projectEmails.length === 0) return [];
      const threadIds = [...new Set(projectEmails.map(pe => pe.thread_id).filter(Boolean))];
      if (threadIds.length === 0) return [];
      const threads = await Promise.all(threadIds.map(id => 
        base44.entities.EmailThread.get(id).catch(() => null)
      ));
      return threads.filter(Boolean);
    },
    enabled: !!project.id && projectEmails.length > 0
  });

  const { data: emailMessages = [] } = useQuery({
    queryKey: ['emailMessagesForProject', project.id],
    queryFn: async () => {
      if (emailThreads.length === 0) return [];
      const threadIds = emailThreads.map(t => t.id);
      const messages = await Promise.all(
        threadIds.map(id => base44.entities.EmailMessage.filter({ thread_id: id }, '-sent_at'))
      );
      return messages.flat();
    },
    enabled: !!project.id && emailThreads.length > 0
  });

  // Build unified thread
  const unifiedThread = React.useMemo(() => {
    return buildUnifiedThread({
      emails: emailMessages,
      emailThreads: emailThreads,
      projectMessages: projectMessages,
      jobMessages: []
    });
  }, [emailMessages, emailThreads, projectMessages]);

  // Get most recent items
  const recentActivity = unifiedThread.slice(0, 5);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4 text-blue-600" />;
      case 'message': return <MessageCircle className="w-4 h-4 text-purple-600" />;
      case 'note': return <FileText className="w-4 h-4 text-green-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityTypeLabel = (item) => {
    if (item.type === 'email') {
      return item.metadata?.is_outbound ? 'Email Sent' : 'Email Received';
    }
    if (item.type === 'message') {
      return item.metadata?.is_internal ? 'Internal Note' : 'Message';
    }
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {recentActivity.length === 0 ? (
          <div className="text-center py-6 text-sm text-[#6B7280]">
            No activity recorded yet
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex gap-3 pb-3 border-b border-[#E5E7EB] last:border-b-0 last:pb-0">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {getActivityTypeLabel(item)}
                    </Badge>
                    <span className="text-[11px] text-[#6B7280]">
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  
                  {item.type === 'email' && item.metadata?.subject && (
                    <div className="text-[13px] font-medium text-[#111827] mb-1">
                      {item.metadata.subject}
                    </div>
                  )}
                  
                  <div className="text-[12px] text-[#4B5563] mb-1">
                    From: {item.authorName}
                  </div>
                  
                  <div className="text-[13px] text-[#111827] line-clamp-2">
                    {item.body?.replace(/<[^>]*>/g, '').substring(0, 150)}
                    {item.body?.length > 150 && '...'}
                  </div>
                  
                  {item.attachments?.length > 0 && (
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      {item.attachments.length} attachment{item.attachments.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Fallback to legacy last_activity if no thread items */}
        {recentActivity.length === 0 && project.last_activity_at && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">
                  Last Updated
                </div>
                <div className="text-[14px] font-semibold text-[#111827] leading-[1.4]">
                  {formatDistanceToNow(parseISO(project.last_activity_at), { addSuffix: true })}
                </div>
                <div className="text-[12px] text-[#6B7280] leading-[1.35] mt-0.5">
                  {format(parseISO(project.last_activity_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-2 border-t border-[#E5E7EB]">
              <Activity className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">
                  Activity Type
                </div>
                <div className="text-[14px] font-medium text-purple-700 leading-[1.4] bg-purple-50 px-2 py-1 rounded-md inline-block">
                  {project.last_activity_type || "Unknown Activity"}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}