import React, { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Briefcase, FolderKanban, Users, Mail, FileText, CheckSquare, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";

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

export default function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getNotifications', { limit: 20 });
      return response.data;
    },
    refetchInterval: 30000 // Poll every 30 seconds
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
    // Mark as read
    if (!notification.is_read) {
      markReadMutation.mutate({ notificationId: notification.id });
    }

    // Navigate to related entity
    if (notification.related_entity_type && notification.related_entity_id) {
      setOpen(false);
      switch (notification.related_entity_type) {
        case 'Job':
          navigate(`${createPageUrl("Jobs")}?jobId=${notification.related_entity_id}`);
          break;
        case 'Project':
          navigate(`${createPageUrl("Projects")}?projectId=${notification.related_entity_id}`);
          break;
        case 'Customer':
          navigate(`${createPageUrl("Customers")}?customerId=${notification.related_entity_id}`);
          break;
        case 'Email':
          navigate(`${createPageUrl("Inbox")}?threadId=${notification.related_entity_id}`);
          break;
        case 'Task':
          navigate(createPageUrl("Tasks"));
          break;
        default:
          break;
      }
    }
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ markAllRead: true });
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 md:w-96 p-0 max-h-[480px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white">
          <h3 className="text-[16px] font-semibold text-[#111827]">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-[12px] text-[#6B7280] hover:text-[#111827] h-7 px-2"
              disabled={markReadMutation.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-4 text-center text-[#6B7280] text-[14px]">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
              <p className="text-[14px] text-[#6B7280]">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {notifications.map((notification) => {
                const TypeIcon = typeIcons[notification.type] || Info;
                const EntityIcon = entityIcons[notification.related_entity_type] || Info;
                
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#F9FAFB] transition-colors ${
                      !notification.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${typeBgColors[notification.type]} flex items-center justify-center`}>
                        <TypeIcon className={`w-4 h-4 ${typeColors[notification.type]}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[14px] leading-tight ${!notification.is_read ? 'font-semibold text-[#111827]' : 'font-medium text-[#374151]'}`}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                          )}
                        </div>
                        
                        {notification.body && (
                          <p className="text-[13px] text-[#6B7280] mt-0.5 line-clamp-2">
                            {notification.body}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1.5">
                          {notification.related_entity_type && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-[#E5E7EB] text-[#6B7280]">
                              <EntityIcon className="w-3 h-3 mr-1" />
                              {notification.related_entity_type}
                            </Badge>
                          )}
                          <span className="text-[11px] text-[#9CA3AF]">
                            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}