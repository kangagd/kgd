import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink, X, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function LinkedEmailsSection({ 
  projectId, 
  jobId,
  onUnlink,
  canUnlink = true 
}) {
  const navigate = useNavigate();

  // Build query filter
  const queryFilter = {};
  if (projectId) {
    queryFilter.$or = [
      { linked_project_id: projectId },
      { linked_project_ids: projectId }
    ];
  }
  if (jobId) {
    queryFilter.$or = [
      { linked_job_id: jobId },
      { linked_job_ids: jobId }
    ];
  }

  const { data: linkedEmails = [], isLoading } = useQuery({
    queryKey: ['linkedEmails', projectId, jobId],
    queryFn: async () => {
      // Fetch all threads and filter client-side for complex queries
      const allThreads = await base44.entities.EmailThread.list('-last_message_date');
      return allThreads.filter(thread => {
        if (projectId) {
          const hasLegacyLink = thread.linked_project_id === projectId;
          const hasNewLink = thread.linked_project_ids?.includes(projectId);
          return hasLegacyLink || hasNewLink;
        }
        if (jobId) {
          const hasLegacyLink = thread.linked_job_id === jobId;
          const hasNewLink = thread.linked_job_ids?.includes(jobId);
          return hasLegacyLink || hasNewLink;
        }
        return false;
      });
    },
    enabled: !!(projectId || jobId)
  });

  const handleOpenEmail = (threadId) => {
    navigate(createPageUrl("Inbox") + `?threadId=${threadId}`);
  };

  const handleUnlink = async (thread) => {
    if (!onUnlink) return;
    onUnlink(thread.id);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-[#F3F4F6] text-[#4B5563]';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700';
      case 'Closed': return 'bg-green-100 text-green-700';
      default: return 'bg-[#F3F4F6] text-[#4B5563]';
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Linked Emails
          </h3>
        </CardHeader>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-[#F3F4F6] rounded-lg" />
            <div className="h-16 bg-[#F3F4F6] rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Linked Emails ({linkedEmails.length})
        </h3>
      </CardHeader>
      <CardContent className="p-3">
        {linkedEmails.length === 0 ? (
          <div className="text-center py-6 bg-[#F8F9FA] rounded-lg">
            <Mail className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
            <p className="text-[14px] text-[#6B7280] leading-[1.4]">No linked emails</p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedEmails.map((thread) => (
              <div
                key={thread.id}
                className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-[#FAE008] hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => handleOpenEmail(thread.id)}
                      className="text-left w-full"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!thread.is_read && (
                          <div className="w-2 h-2 bg-[#FAE008] rounded-full flex-shrink-0" />
                        )}
                        <h4 className={`text-[14px] ${!thread.is_read ? 'font-semibold' : 'font-medium'} text-[#111827] truncate hover:text-[#FAE008] transition-colors`}>
                          {thread.subject}
                        </h4>
                      </div>
                      <p className="text-[12px] text-[#4B5563] truncate">
                        {thread.from_address}
                      </p>
                    </button>
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className={`${getStatusColor(thread.status)} text-[10px] px-1.5 py-0 border-0`}>
                        {thread.status}
                      </Badge>
                      {thread.priority && thread.priority !== 'Normal' && (
                        <Badge className={`${getPriorityColor(thread.priority)} text-[10px] px-1.5 py-0 border-0`}>
                          {thread.priority}
                        </Badge>
                      )}
                      {thread.category && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {thread.category}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                        <Clock className="w-3 h-3" />
                        {thread.last_message_date && format(parseISO(thread.last_message_date), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEmail(thread.id)}
                      className="h-7 w-7"
                      title="Open email"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    {canUnlink && onUnlink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUnlink(thread)}
                        className="h-7 w-7 hover:text-red-600 hover:bg-red-50"
                        title="Unlink email"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}