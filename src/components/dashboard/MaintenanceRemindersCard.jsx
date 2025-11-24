import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, AlertCircle, MapPin } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  "Pending": "bg-amber-100 text-amber-800",
  "Sent": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Skipped": "bg-slate-100 text-slate-700"
};

export default function MaintenanceRemindersCard({ user }) {
  const navigate = useNavigate();

  const { data: allReminders = [] } = useQuery({
    queryKey: ['allMaintenanceReminders'],
    queryFn: () => base44.entities.MaintenanceReminder.list('-due_date'),
    enabled: user?.role === 'admin'
  });

  // Filter for upcoming and overdue reminders (exclude completed/skipped)
  const activeReminders = allReminders.filter(r => 
    r.status !== 'Completed' && r.status !== 'Skipped'
  ).slice(0, 5);

  const overdueCount = activeReminders.filter(r => 
    r.due_date && isPast(parseISO(r.due_date)) && r.status === 'Pending'
  ).length;

  if (user?.role !== 'admin') {
    return null;
  }

  const handleReminderClick = (reminder) => {
    navigate(createPageUrl("Projects") + `?projectId=${reminder.project_id}`);
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#6B7280]" />
            <CardTitle className="text-[16px] font-semibold text-[#111827]">
              Maintenance Reminders
            </CardTitle>
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {overdueCount} Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {activeReminders.length === 0 ? (
          <div className="text-center py-8 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <Wrench className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[14px] text-[#6B7280]">No active maintenance reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeReminders.map((reminder) => {
              const isOverdue = reminder.due_date && isPast(parseISO(reminder.due_date));
              const dueDate = reminder.due_date ? parseISO(reminder.due_date) : null;

              return (
                <div
                  key={reminder.id}
                  onClick={() => handleReminderClick(reminder)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                    isOverdue 
                      ? 'border-red-200 bg-red-50 hover:border-red-300' 
                      : 'border-[#E5E7EB] bg-white hover:border-[#FAE008]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-medium text-[#111827] truncate">
                        {reminder.project_title}
                      </h4>
                      <p className="text-[12px] text-[#6B7280] truncate">
                        {reminder.customer_name}
                      </p>
                    </div>
                    <Badge className={statusColors[reminder.status]}>
                      {reminder.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-[#6B7280]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {dueDate ? format(dueDate, 'MMM d, yyyy') : 'No date'}
                      </span>
                    </div>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}