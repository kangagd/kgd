import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Clock, User } from "lucide-react";

const fieldLabels = {
  scheduled_date: "Scheduled Date",
  scheduled_time: "Scheduled Time",
  notes: "Notes",
  additional_info: "Additional Info",
  status: "Status",
  outcome: "Outcome",
  assigned_to: "Assigned To",
  address: "Address",
  job_type_name: "Job Type",
};

export default function ChangeHistoryModal({ open, onClose, jobId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['changeHistory', jobId],
    queryFn: () => base44.entities.ChangeHistory.filter({ job_id: jobId }, '-created_date'),
    enabled: open && !!jobId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] border-2 border-slate-300 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b-2 border-slate-200">
          <DialogTitle className="text-2xl font-bold text-[#000000] tracking-tight">Change History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-xl p-5 h-24" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium text-base">No changes recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((change) => (
                <div key={change.id} className="bg-white rounded-xl p-5 border-2 border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className="font-bold text-base text-[#000000]">
                        {change.changed_by_name || change.changed_by}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Clock className="w-4 h-4" />
                      {format(new Date(change.created_date), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  
                  <div className="text-base">
                    <span className="font-bold text-[#000000]">
                      {fieldLabels[change.field_name] || change.field_name}
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                      {change.old_value && (
                        <>
                          <span className="text-slate-500 line-through font-medium bg-slate-100 px-3 py-1 rounded-lg">{change.old_value}</span>
                          <span className="text-slate-400 font-bold">→</span>
                        </>
                      )}
                      <span className="text-[#000000] font-bold bg-[#fae008]/20 px-3 py-1 rounded-lg border-2 border-[#fae008]/40">{change.new_value || '(empty)'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}