import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageCircle, History, Image as ImageIcon, FileText, User, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ActivityTab({ project }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  // Fetch all activity sources
  const { data: projectEmails = [] } = useQuery({
    queryKey: ['projectEmails', project.id],
    queryFn: () => base44.entities.ProjectEmail.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: emailThreads = [] } = useQuery({
    queryKey: ['emailThreadsForProject', project.id],
    queryFn: async () => {
      if (!project.id) return [];
      const threads = await base44.entities.EmailThread.filter({ linked_project_id: project.id });
      return threads;
    },
    enabled: !!project.id
  });

  const { data: projectMessages = [] } = useQuery({
    queryKey: ['projectMessages', project.id],
    queryFn: () => base44.entities.ProjectMessage.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: changeHistory = [] } = useQuery({
    queryKey: ['projectChangeHistory', project.id],
    queryFn: () => base44.entities.ChangeHistory.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['projectPhotos', project.id],
    queryFn: () => base44.entities.Photo.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  // Combine all activities into unified timeline
  const activities = useMemo(() => {
    const items = [];

    // Email threads
    emailThreads.forEach(thread => {
      items.push({
        id: `email-${thread.id}`,
        type: 'email',
        category: 'external',
        timestamp: thread.last_message_date || thread.created_date,
        title: thread.subject,
        description: thread.last_message_snippet,
        metadata: {
          from: thread.from_address,
          status: thread.status,
          threadId: thread.id
        },
        icon: Mail,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      });
    });

    // Internal messages/notes
    projectMessages.forEach(msg => {
      items.push({
        id: `message-${msg.id}`,
        type: 'note',
        category: 'internal',
        timestamp: msg.created_date,
        title: 'Internal note',
        description: msg.message,
        metadata: {
          sender: msg.sender_name || msg.sender_email,
        },
        icon: MessageCircle,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      });
    });

    // Change history (decisions)
    changeHistory.forEach(change => {
      // Skip certain automated changes
      if (change.field_name === 'last_activity_at' || change.field_name === 'last_activity_type') {
        return;
      }

      items.push({
        id: `change-${change.id}`,
        type: 'decision',
        category: 'internal',
        timestamp: change.created_date,
        title: `${change.field_name.replace(/_/g, ' ')} changed`,
        description: `From "${change.old_value}" to "${change.new_value}"`,
        metadata: {
          changedBy: change.changed_by_name || change.changed_by,
          field: change.field_name
        },
        icon: History,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50'
      });
    });

    // Photos
    photos.forEach(photo => {
      items.push({
        id: `photo-${photo.id}`,
        type: 'photo',
        category: 'internal',
        timestamp: photo.uploaded_at || photo.created_date,
        title: 'Photo added',
        description: photo.notes || '',
        metadata: {
          uploadedBy: photo.technician_name || photo.technician_email,
          url: photo.image_url,
          tags: photo.tags
        },
        icon: ImageIcon,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      });
    });

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return items;
  }, [emailThreads, projectMessages, changeHistory, photos]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filter === "all") return activities;
    if (filter === "external") return activities.filter(a => a.category === "external");
    if (filter === "internal") return activities.filter(a => a.category === "internal");
    if (filter === "decisions") return activities.filter(a => a.type === "decision");
    return activities;
  }, [activities, filter]);

  const handleEmailThreadClick = (threadId) => {
    navigate(`${createPageUrl("Inbox")}?threadId=${threadId}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="external">External</TabsTrigger>
          <TabsTrigger value="internal">Internal</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Activity Timeline */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-8 text-center">
              <p className="text-[14px] text-[#6B7280]">No activity to display</p>
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => {
            const Icon = activity.icon;
            return (
              <Card 
                key={activity.id} 
                className={`border border-[#E5E7EB] hover:border-[#FAE008] transition-all ${activity.type === 'email' ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (activity.type === 'email') {
                    handleEmailThreadClick(activity.metadata.threadId);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${activity.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[14px] font-semibold text-[#111827]">
                            {activity.title}
                          </h4>
                          {activity.type === 'email' && (
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.status}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
                          {format(parseISO(activity.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                      
                      {activity.description && (
                        <p className="text-[13px] text-[#4B5563] line-clamp-2 mb-2">
                          {activity.description}
                        </p>
                      )}

                      {activity.metadata && (
                        <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                          {activity.metadata.from && (
                            <span>From: {activity.metadata.from}</span>
                          )}
                          {activity.metadata.sender && (
                            <span>By: {activity.metadata.sender}</span>
                          )}
                          {activity.metadata.changedBy && (
                            <span>By: {activity.metadata.changedBy}</span>
                          )}
                          {activity.metadata.uploadedBy && (
                            <span>By: {activity.metadata.uploadedBy}</span>
                          )}
                          {activity.metadata.tags && activity.metadata.tags.length > 0 && (
                            <div className="flex gap-1">
                              {activity.metadata.tags.map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activity.type === 'email' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEmailThreadClick(activity.metadata.threadId);
                          }}
                          className="mt-2 text-[12px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          View thread <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {activity.type === 'photo' && activity.metadata.url && (
                        <img 
                          src={activity.metadata.url} 
                          alt="Activity photo"
                          className="mt-2 rounded-lg w-32 h-32 object-cover border border-[#E5E7EB]"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}