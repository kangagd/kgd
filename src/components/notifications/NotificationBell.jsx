import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Briefcase, FolderKanban, Users, Mail, FileText, CheckSquare, Info, AlertTriangle, AlertCircle, CheckCircle, ExternalLink, Truck, Car } from "lucide-react";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

const priorityIcons = {
  normal: Info,
  high: AlertTriangle
};

const priorityStyles = {
  normal: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-600"
};

const entityIcons = {
  Job: Briefcase,
  Project: FolderKanban,
  Customer: Users,
  Email: Mail,
  Quote: FileText,
  Task: CheckSquare,
  Vehicle: Car,
  Part: Truck,
  Contract: FileText,
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
    case 'Vehicle':
      return createPageUrl("Fleet");
    case 'Part':
      return createPageUrl("Logistics");
    case 'Contract':
      return createPageUrl("Contracts");
    default:
      return null;
  }
};

// Notification Item Component
function NotificationItem({ notification, onClose, onMarkRead }) {
  const navigate = useNavigate();
  const PriorityIcon = priorityIcons[notification.priority] || Info;
  const EntityIcon = entityIcons[notification.entity_type] || Info;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }

    if (notification.entity_type && notification.entity_id) {
      const url = getEntityUrl(notification.entity_type, notification.entity_id);
      if (url) {
        onClose();
        navigate(url);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 hover:bg-[#F9FAFB] transition-colors border-b border-[#E5E7EB] last:border-0 ${
        !notification.is_read ? 'bg-[#F3F4F6]/50' : 'bg-white'
      }`}
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${priorityStyles[notification.priority || 'normal']} flex items-center justify-center`}>
          <PriorityIcon className="w-4 h-4" />
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
          
          {notification.message && (
            <p className="text-[13px] text-[#6B7280] mt-1 line-clamp-2 leading-snug">
              {notification.message}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {notification.entity_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-[#E5E7EB] text-[#6B7280] font-medium bg-white">
                <EntityIcon className="w-3 h-3 mr-1" />
                {notification.entity_type}
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

// Group notifications by date
const groupNotifications = (notifications) => {
  const groups = {
    today: [],
    yesterday: [],
    older: []
  };

  notifications.forEach(n => {
    const date = new Date(n.created_date);
    if (isToday(date)) {
      groups.today.push(n);
    } else if (isYesterday(date)) {
      groups.yesterday.push(n);
    } else {
      groups.older.push(n);
    }
  });

  return groups;
};

// Notification List Component
function NotificationList({ notifications, isLoading, onClose, onMarkRead, onMarkAllRead, unreadCount }) {
  const grouped = groupNotifications(notifications);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h3 className="text-[16px] font-semibold text-[#111827]">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] h-5 px-1.5">
              {unreadCount} new
            </Badge>
          )}
        </div>
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
      <div className="overflow-y-auto flex-1 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-[#6B7280] text-[14px]">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <h4 className="text-[14px] font-medium text-[#111827]">No notifications</h4>
            <p className="text-[13px] text-[#6B7280] mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="pb-4">
            {grouped.today.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider sticky top-0 border-b border-[#E5E7EB]">
                  Today
                </div>
                {grouped.today.map(n => (
                  <NotificationItem key={n.id} notification={n} onClose={onClose} onMarkRead={onMarkRead} />
                ))}
              </div>
            )}
            
            {grouped.yesterday.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider sticky top-0 border-b border-[#E5E7EB] border-t">
                  Yesterday
                </div>
                {grouped.yesterday.map(n => (
                  <NotificationItem key={n.id} notification={n} onClose={onClose} onMarkRead={onMarkRead} />
                ))}
              </div>
            )}

            {grouped.older.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-[#F9FAFB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider sticky top-0 border-b border-[#E5E7EB] border-t">
                  Older
                </div>
                {grouped.older.map(n => (
                  <NotificationItem key={n.id} notification={n} onClose={onClose} onMarkRead={onMarkRead} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
      const response = await base44.functions.invoke('getNotifications', { limit: 50 });
      return response.data;
    },
    refetchInterval: 30000
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
      
      toast(notification.title, {
        description: notification.message,
        action: notification.entity_type && notification.entity_id ? {
          label: "View",
          onClick: () => {
            markReadMutation.mutate({ notificationId: notification.id });
            const url = getEntityUrl(notification.entity_type, notification.entity_id);
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
      className={`relative p-2 rounded-lg transition-colors ${isMobile ? 'p-3' : 'hover:bg-[#F3F4F6] hover:text-[#111827] text-[#6B7280]'}`}
      title="Notifications"
    >
      <Bell className={`${isMobile ? 'w-6 h-6 text-[#111827]' : 'w-5 h-5'}`} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 bg-[#DC2626] text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 border-2 border-white">
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
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl flex flex-col bg-white">
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
      <PopoverContent align="end" className="w-96 p-0 max-h-[600px] overflow-hidden flex flex-col shadow-xl border-[#E5E7EB] rounded-xl">
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