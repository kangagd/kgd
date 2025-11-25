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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function RescheduleConfirmModal({
  open,
  onClose,
  onConfirm,
  job,
  newDate,
  newTime,
  notifyTechnician,
  setNotifyTechnician,
  isSubmitting = false
}) {
  if (!job) return null;

  const oldDate = job.scheduled_date ? format(parseISO(job.scheduled_date), 'MMM d, yyyy') : 'Not set';
  const oldTime = job.scheduled_time || 'Not set';
  const formattedNewDate = newDate ? format(typeof newDate === 'string' ? parseISO(newDate) : newDate, 'MMM d, yyyy') : oldDate;
  const formattedNewTime = newTime || oldTime;

  const dateChanged = newDate && job.scheduled_date !== (typeof newDate === 'string' ? newDate : format(newDate, 'yyyy-MM-dd'));
  const timeChanged = newTime && job.scheduled_time !== newTime;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-2xl border border-[#E5E7EB]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-[#111827]">
            Confirm Reschedule
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-[#4B5563]">
              <p>
                You are about to reschedule <span className="font-semibold text-[#111827]">Job #{job.job_number}</span> for <span className="font-semibold text-[#111827]">{job.customer_name}</span>.
              </p>

              {/* Schedule Change Summary */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-3">
                {dateChanged && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#6B7280] line-through">{oldDate}</span>
                      <ArrowRight className="w-4 h-4 text-[#111827]" />
                      <span className="font-semibold text-[#111827]">{formattedNewDate}</span>
                    </div>
                  </div>
                )}
                {timeChanged && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#6B7280] line-through">{oldTime}</span>
                      <ArrowRight className="w-4 h-4 text-[#111827]" />
                      <span className="font-semibold text-[#111827]">{formattedNewTime}</span>
                    </div>
                  </div>
                )}
                {!dateChanged && !timeChanged && (
                  <p className="text-sm text-[#6B7280]">No changes detected</p>
                )}
              </div>

              {/* Notify Technician Option */}
              {job.assigned_to && job.assigned_to.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <Checkbox
                    id="notify"
                    checked={notifyTechnician}
                    onCheckedChange={setNotifyTechnician}
                    className="mt-0.5"
                  />
                  <label htmlFor="notify" className="text-sm cursor-pointer">
                    <span className="font-medium text-[#111827]">Notify assigned technician(s)</span>
                    <p className="text-[#6B7280] mt-0.5">
                      Send a notification to {job.assigned_to_name?.join(', ') || 'assigned technicians'} about this schedule change.
                    </p>
                  </label>
                </div>
              )}
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
            disabled={isSubmitting || (!dateChanged && !timeChanged)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] rounded-xl font-semibold"
          >
            {isSubmitting ? 'Updating...' : 'Confirm Reschedule'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}