import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function NotificationPreferences({ user }) {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notificationPreferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const prefs = await base44.entities.NotificationPreference.filter({ user_id: user.id });
      if (prefs.length === 0) {
        // Create default preferences
        const isAdmin = user.role === 'admin';
        return await base44.entities.NotificationPreference.create({
          user_id: user.id,
          user_email: user.email,
          role: user.role,
          job_assigned: true,
          job_start_reminder: true,
          overlap_warning: isAdmin,
          job_overdue: isAdmin,
          check_in_out: isAdmin
        });
      }
      return prefs[0];
    },
    enabled: !!user
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: ({ field, value }) => 
      base44.entities.NotificationPreference.update(preferences.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences', user?.id] });
      toast.success('Notification preferences updated');
    },
    onError: () => {
      toast.error('Failed to update preferences');
    }
  });

  const handleToggle = (field, value) => {
    updatePreferenceMutation.mutate({ field, value });
  };

  if (isLoading || !preferences) {
    return (
      <Card className="border border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
          <div className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
          <div className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <Card className="border border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Notifications</CardTitle>
        <p className="text-[14px] text-[#6B7280] leading-[1.4] mt-1">
          Choose what notifications you want to receive
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
          <div className="space-y-1">
            <Label htmlFor="job_assigned" className="text-[14px] font-medium text-[#111827]">
              New job assigned
            </Label>
            <p className="text-[12px] text-[#6B7280] leading-[1.35]">
              Get notified when a job is assigned to you
            </p>
          </div>
          <Switch
            id="job_assigned"
            checked={preferences.job_assigned}
            onCheckedChange={(value) => handleToggle('job_assigned', value)}
          />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
          <div className="space-y-1">
            <Label htmlFor="job_start_reminder" className="text-[14px] font-medium text-[#111827]">
              Job start reminders
            </Label>
            <p className="text-[12px] text-[#6B7280] leading-[1.35]">
              Remind me 10-15 minutes before a job starts
            </p>
          </div>
          <Switch
            id="job_start_reminder"
            checked={preferences.job_start_reminder}
            onCheckedChange={(value) => handleToggle('job_start_reminder', value)}
          />
        </div>

        {isAdmin && (
          <>
            <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
              <div className="space-y-1">
                <Label htmlFor="overlap_warning" className="text-[14px] font-medium text-[#111827]">
                  Overlap warnings
                </Label>
                <p className="text-[12px] text-[#6B7280] leading-[1.35]">
                  Alert when technicians have schedule conflicts
                </p>
              </div>
              <Switch
                id="overlap_warning"
                checked={preferences.overlap_warning}
                onCheckedChange={(value) => handleToggle('overlap_warning', value)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
              <div className="space-y-1">
                <Label htmlFor="job_overdue" className="text-[14px] font-medium text-[#111827]">
                  Job overdue alerts
                </Label>
                <p className="text-[12px] text-[#6B7280] leading-[1.35]">
                  Alert when jobs go past their expected completion time
                </p>
              </div>
              <Switch
                id="job_overdue"
                checked={preferences.job_overdue}
                onCheckedChange={(value) => handleToggle('job_overdue', value)}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between py-3">
          <div className="space-y-1">
            <Label htmlFor="check_in_out" className="text-[14px] font-medium text-[#111827]">
              Check-in / Check-out alerts
            </Label>
            <p className="text-[12px] text-[#6B7280] leading-[1.35]">
              {isAdmin ? 'Get notified when technicians check in or out' : 'Confirmation when you check in or out'}
            </p>
          </div>
          <Switch
            id="check_in_out"
            checked={preferences.check_in_out}
            onCheckedChange={(value) => handleToggle('check_in_out', value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}