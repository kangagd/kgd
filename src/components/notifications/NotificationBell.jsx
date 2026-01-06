import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Briefcase, FolderKanban, Users, Mail, FileText, CheckSquare, Info, AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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

// Helper to get navigation URL for entity
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

// Notification Item Component
function NotificationItem({ notification, onClose, onMarkRead }) {
  const navigate = useNavigate();
  const TypeIcon = typeIcons[notification.type] || Info;
  const EntityIcon = entityIcons[notification.related_entity_type] || Info;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }

    if (notification.related_entity_type && notification.related_entity_id) {
      const url = getEntityUrl(notification.related_entity_type, notification.related_entity_id);
      if (url) {
        onClose();
        navigate(url);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 hover:bg-[#F9FAFB] transition-colors ${
        !notification.is_read ? 'bg-[#F3F4F6]' : 'bg-white'
      }`}
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${typeBgColors[notification.type]} flex items-center justify-center`}>
          <TypeIcon className={`w-4 h-4 ${typeColors[notification.type]}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[14px] leading-tight ${!notification.is_read ? 'font-semibold text-[#111827]' : 'font-medium text-[#374151]'}`}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="flex-shrink-0 w-2 h-2 bg-[#FAE008] rounded-full mt-1.5" />
            )}
          </div>
          
          {notification.body && (
            <p className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-2">
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
}

// Notification List Component (shared between popover and sheet)
function NotificationList({ notifications, isLoading, onClose, onMarkRead, onMarkAllRead, unreadCount }) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white flex-shrink-0">
        <h3 className="text-[16px] font-semibold text-[#111827]">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="text-[12px] text-[#6B7280] hover:text-[#111827] h-7 px-2"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
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
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={onClose}
                onMarkRead={onMarkRead}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-[#E5E7EB] bg-white flex-shrink-0">
          <Link
            to={createPageUrl("Notifications")}
            onClick={onClose}
            className="flex items-center justify-center gap-2 text-[13px] font-medium text-[#4B5563] hover:text-[#111827] transition-colors no-underline"
          >
            View all notifications
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </>
  );
}

export default function NotificationBell({ isMobile = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const lastSeenRef = useRef(localStorage.getItem('notificationLastSeen') || new Date().toISOString());
  const shownToastsRef = useRef(new Set(JSON.parse(localStorage.getItem('shownNotificationToasts') || '[]')));

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getNotifications', { limit: 50 });
        return response.data || { notifications: [], unread_count: 0 };
      } catch (error) {
        // Silently fail to prevent toast spam
        console.error('Error fetching notifications:', error);
        return { notifications: [], unread_count: 0 };
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Poll every 60 seconds for new notifications
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: false, // Don't retry on errors to prevent cascading failures
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

  // Show toast for new notifications
  useEffect(() => {
    if (!data?.notifications) return;

    const lastSeen = new Date(lastSeenRef.current);
    const newNotifications = data.notifications.filter(n => {
      const createdAt = new Date(n.created_date);
      return createdAt > lastSeen && !n.is_read && !shownToastsRef.current.has(n.id);
    });

    newNotifications.forEach(notification => {
      shownToastsRef.current.add(notification.id);
      
      const toastFn = notification.type === 'error' ? toast.error 
        : notification.type === 'warning' ? toast.warning 
        : notification.type === 'success' ? toast.success 
        : toast.info;

      toastFn(notification.title, {
        description: notification.body,
        action: notification.related_entity_type && notification.related_entity_id ? {
          label: "View",
          onClick: () => {
            markReadMutation.mutate({ notificationId: notification.id });
            const url = getEntityUrl(notification.related_entity_type, notification.related_entity_id);
            if (url) navigate(url);
          }
        } : undefined,
        duration: 5000
      });
    });

    // Update last seen
    if (data.notifications.length > 0) {
      const latestDate = data.notifications[0].created_date;
      lastSeenRef.current = latestDate;
      localStorage.setItem('notificationLastSeen', latestDate);
      localStorage.setItem('shownNotificationToasts', JSON.stringify([...shownToastsRef.current].slice(-50)));
    }
  }, [data?.notifications]);

  const handleMarkRead = (notificationId) => {
    markReadMutation.mutate({ notificationId });
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ markAllRead: true });
  };

  const handleClose = () => setOpen(false);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  const bellButton = (
    <button
      className="relative p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
      title="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-[#FAE008] text-[#111827] text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  // Mobile: use Sheet (bottom drawer)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {bellButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl flex flex-col">
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            onClose={handleClose}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            unreadCount={unreadCount}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {bellButton}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 md:w-96 p-0 max-h-[480px] overflow-hidden flex flex-col">
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onClose={handleClose}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          unreadCount={unreadCount}
        />
      </PopoverContent>
    </Popover>
  );
}