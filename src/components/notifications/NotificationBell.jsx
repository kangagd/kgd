import React, { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 50);
    },
    enabled: !!user,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative h-9 w-9 hover:bg-[#F3F4F6] rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-[#111827]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#FAE008] rounded-full border-2 border-white" />
        )}
      </Button>
      
      <NotificationPanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        user={user}
      />
    </>
  );
}