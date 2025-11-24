import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Calendar, CheckCircle, X, Edit, AlertCircle, Clock } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusColors = {
  "Pending": "bg-amber-100 text-amber-800",
  "Sent": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Skipped": "bg-slate-100 text-slate-700"
};

export default function MaintenanceSection({ projectId }) {
  const [editingReminder, setEditingReminder] = useState(null);
  const [editForm, setEditForm] = useState({ due_date: "", notes: "" });
  const queryClient = useQueryClient();

  const { data: reminders = [] } = useQuery({
    queryKey: ['maintenanceReminders', projectId],
    queryFn: () => base44.entities.MaintenanceReminder.filter({ project_id: projectId }),
    refetchInterval: 30000
  });

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceReminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceReminders', projectId] });
      setEditingReminder(null);
      toast.success('Reminder updated');
    },
    onError: (error) => {
      toast.error('Failed to update reminder');
      console.error(error);
    }
  });

  const handleStatusChange = (reminder, newStatus) => {
    updateReminderMutation.mutate({
      id: reminder.id,
      data: { status: newStatus }
    });
  };

  const handleEditStart = (reminder) => {
    setEditingReminder(reminder.id);
    setEditForm({
      due_date: reminder.due_date,
      notes: reminder.notes || ""
    });
  };

  const handleEditSave = () => {
    if (!editingReminder) return;
    updateReminderMutation.mutate({
      id: editingReminder,
      data: editForm
    });
  };

  const handleEditCancel = () => {
    setEditingReminder(null);
    setEditForm({ due_date: "", notes: "" });
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-[#6B7280]" />
          <CardTitle className="text-[16px] font-semibold text-[#111827]">
            Maintenance Reminders ({reminders.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {reminders.length === 0 ? (
          <div className="text-center py-8 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <Clock className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[14px] text-[#6B7280]">
              No maintenance reminders yet
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">
              A reminder will be created when project is completed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => {
              const isOverdue = reminder.due_date && isPast(parseISO(reminder.due_date)) && reminder.status === 'Pending';
              const isEditing = editingReminder === reminder.id;

              return (
                <div
                  key={reminder.id}
                  className="border border-[#E5E7EB] rounded-lg p-4 bg-white hover:shadow-sm transition-all"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[13px] font-medium text-[#4B5563] mb-1 block">
                          Due Date
                        </label>
                        <Input
                          type="date"
                          value={editForm.due_date}
                          onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[13px] font-medium text-[#4B5563] mb-1 block">
                          Notes
                        </label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Add notes..."
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleEditSave}
                          size="sm"
                          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleEditCancel}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={statusColors[reminder.status]}>
                              {reminder.status}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Due: {format(parseISO(reminder.due_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {reminder.notes && (
                            <p className="text-[13px] text-[#6B7280] mt-2">
                              {reminder.notes}
                            </p>
                          )}
                        </div>
                        {reminder.status !== 'Completed' && reminder.status !== 'Skipped' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStart(reminder)}
                            className="h-8 w-8 text-[#6B7280] hover:text-[#111827]"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {reminder.status !== 'Completed' && reminder.status !== 'Skipped' && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E5E7EB]">
                          <Button
                            onClick={() => handleStatusChange(reminder, 'Completed')}
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Mark Completed
                          </Button>
                          <Button
                            onClick={() => handleStatusChange(reminder, 'Skipped')}
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Skip
                          </Button>
                          {reminder.status === 'Pending' && (
                            <Button
                              onClick={() => handleStatusChange(reminder, 'Sent')}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              Mark as Sent
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}