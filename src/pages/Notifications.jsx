import React, { useState } from "react";
import { Bell, CheckCheck, Briefcase, FolderKanban, Users, Mail, FileText, CheckSquare, Info, AlertTriangle, AlertCircle, CheckCircle, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow, format } from "date-fns";

const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle
};

const typeColors = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500"
};

const typeBgColors = {
  info: "bg-blue-50",
  success: "bg-green-50",
  warning: "bg-amber-50",
  error: "bg-red-50"
};

const entityIcons = {
  Job: Briefcase,
  Project: FolderKanban,
  Customer: Users,
  Email: Mail,
  Quote: FileText,
  Task: CheckSquare,
  Other: Info
};

const getEntityUrl = (entityType, entityId) => {
  switch (entityType) {
    case 'Job':
      return `${createPageUrl("Jobs")}?jobId=${entityId}`;
    case 'Project':
      return `${createPageUrl("Projects")}?projectId=${entityId}`;
    case 'Customer':
      return `${createPageUrl("Customers")}?customerId=${entityId}`;
    case 'Email':
      return `${createPageUrl("Inbox")}?threadId=${entityId}`;
    case 'Task':
      return createPageUrl("Tasks");
    default:
      return null;
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter, limit],
    queryFn: async () => {
      const response = await base44.functions.invoke('getNotifications', { 
        limit,
        only_unread: filter === 'unread'
      });
      return response.data;
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ notificationId, markAllRead }) => {
      const response = await base44.functions.invoke('markNotificationRead', {
        notificationId,
        markAllRead
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate({ notificationId: notification.id });
    }

    if (notification.related_entity_type && notification.related_entity_id) {
      const url = getEntityUrl(notification.related_entity_type, notification.related_entity_id);
      if (url) navigate(url);
    }
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ markAllRead: true });
  };

  const handleToggleRead = (e, notification) => {
    e.stopPropagation();
    markReadMutation.mutate({ notificationId: notification.id });
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  // Filter notifications based on tab
  const filteredNotifications = filter === 'read' 
    ? notifications.filter(n => n.is_read)
    : filter === 'unread'
      ? notifications.filter(n => !n.is_read)
      : notifications;

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-[#ffffff] min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 hover:bg-[#F3F4F6] rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-[22px] font-semibold text-[#111827]">Notifications</h1>
              <p className="text-[13px] text-[#6B7280]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-[13px] h-9"
              disabled={markReadMutation.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-initial">All</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 sm:flex-initial">
              Unread
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-[#FAE008] text-[#111827] text-[10px] px-1.5 py-0 h-5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" className="flex-1 sm:flex-initial">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notification List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-[#F3F4F6] rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-[#F3F4F6] rounded w-2/3 mb-2" />
                      <div className="h-3 bg-[#F3F4F6] rounded w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
              <p className="text-[16px] font-medium text-[#111827] mb-1">
                {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
              </p>
              <p className="text-[14px] text-[#6B7280]">
                {filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here when activity happens.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => {
              const TypeIcon = typeIcons[notification.type] || Info;
              const EntityIcon = entityIcons[notification.related_entity_type] || Info;

              return (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-[#FAE008] ${
                    !notification.is_read ? 'bg-[#F9FAFB] border-l-4 border-l-[#FAE008]' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${typeBgColors[notification.type]} flex items-center justify-center`}>
                        <TypeIcon className={`w-5 h-5 ${typeColors[notification.type]}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[14px] leading-tight ${!notification.is_read ? 'font-semibold text-[#111827]' : 'font-medium text-[#374151]'}`}>
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0 hover:bg-[#F3F4F6]"
                            onClick={(e) => handleToggleRead(e, notification)}
                            title={notification.is_read ? 'Mark as unread' : 'Mark as read'}
                          >
                            {notification.is_read ? (
                              <Bell className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-[#6B7280]" />
                            )}
                          </Button>
                        </div>
                        
                        {notification.body && (
                          <p className="text-[13px] text-[#6B7280] mt-1">
                            {notification.body}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          {notification.related_entity_type && (
                            <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-[#E5E7EB] text-[#6B7280]">
                              <EntityIcon className="w-3 h-3 mr-1" />
                              {notification.related_entity_type}
                            </Badge>
                          )}
                          <span className="text-[12px] text-[#9CA3AF]">
                            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Load More */}
            {filteredNotifications.length >= limit && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLimit(prev => prev + 20)}
                  className="text-[13px]"
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}