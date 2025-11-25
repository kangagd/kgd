import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function ConflictWarningModal({
  open,
  onClose,
  onConfirm,
  draggedJob,
  conflictingJobs = [],
  newDate,
  newTime,
  isSubmitting = false
}) {
  if (!draggedJob) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-2xl border border-[#E5E7EB] max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-[#111827]">
            <AlertTriangle className="w-5 h-5 text-[#D97706]" />
            Schedule Conflict Detected
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-[#4B5563]">
              <p>
                Moving <span className="font-semibold text-[#111827]">Job #{draggedJob.job_number}</span> to this time slot may cause scheduling conflicts.
              </p>

              {/* New Schedule */}
              <div className="bg-[#FAE008]/10 border border-[#FAE008] rounded-xl p-3">
                <div className="text-sm font-semibold text-[#111827] mb-2">New Schedule</div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#6B7280]" />
                    <span>{newDate ? format(typeof newDate === 'string' ? parseISO(newDate) : newDate, 'MMM d, yyyy') : 'Same date'}</span>
                  </div>
                  {newTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#6B7280]" />
                      <span>{newTime}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Conflicting Jobs */}
              {conflictingJobs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[#111827]">
                    Overlapping Jobs ({conflictingJobs.length})
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {conflictingJobs.map((job) => (
                      <div
                        key={job.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[#111827] text-sm">
                              Job #{job.job_number} - {job.customer_name}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {job.scheduled_time || 'No time'}
                              </span>
                              {job.expected_duration && (
                                <span>{job.expected_duration}h duration</span>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                            Conflict
                          </Badge>
                        </div>
                        {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-[#6B7280] mt-2">
                            <User className="w-3 h-3" />
                            {job.assigned_to_name.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm">
                Do you want to proceed with this schedule change anyway?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="rounded-xl font-semibold border border-[#E5E7EB]"
            disabled={isSubmitting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl font-semibold"
          >
            {isSubmitting ? 'Updating...' : 'Proceed Anyway'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}