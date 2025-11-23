import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Briefcase, Clock, AlertTriangle, CheckCircle, LogIn, LogOut } from "lucide-react";

const notificationIcons = {
  job_assigned: Briefcase,
  job_start_reminder: Clock,
  overlap_warning: AlertTriangle,
  job_overdue: AlertTriangle,
  check_in: LogIn,
  check_out: LogOut
};

const notificationColors = {
  job_assigned: "text-blue-600",
  job_start_reminder: "text-[#FAE008]",
  overlap_warning: "text-orange-600",
  job_overdue: "text-red-600",
  check_in: "text-green-600",
  check_out: "text-purple-600"
};

export default function NotificationPanel({ open, onClose, notifications, user }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.update(notificationId, { read_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.read_at);
      await Promise.all(
        unreadNotifications.map(n => 
          base44.entities.Notification.update(n.id, { read_at: new Date().toISOString() })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  const handleNotificationClick = (notification) => {
    if (!notification.read_at) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate based on metadata
    if (notification.metadata?.job_id) {
      onClose();
      navigate(`${createPageUrl("Jobs")}?jobId=${notification.metadata.job_id}`);
    } else if (notification.metadata?.project_id) {
      onClose();
      navigate(`${createPageUrl("Projects")}?projectId=${notification.metadata.project_id}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              Notifications
            </SheetTitle>
            {notifications.some(n => !n.read_at) && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-[12px] text-[#FAE008] hover:text-[#E5CF07] font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
              <p className="text-[14px] text-[#6B7280] leading-[1.4]">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Briefcase;
              const iconColor = notificationColors[notification.type] || "text-[#4B5563]";
              const isUnread = !notification.read_at;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isUnread
                      ? 'bg-[#FAE008]/5 border-[#FAE008]/30 hover:bg-[#FAE008]/10'
                      : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={`text-[14px] leading-[1.4] ${isUnread ? 'font-semibold text-[#111827]' : 'font-medium text-[#4B5563]'}`}>
                          {notification.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 bg-[#FAE008] rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-[13px] text-[#6B7280] leading-[1.4] mb-2">
                        {notification.body}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] leading-[1.35]">
                        {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}