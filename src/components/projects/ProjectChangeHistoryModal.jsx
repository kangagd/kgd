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
  title: "Title",
  description: "Description",
  notes: "Notes",
  status: "Status",
  project_type: "Project Type",
  financial_status: "Financial Status",
  address: "Address",
  quote_value: "Quote Value",
  invoice_value: "Invoice Value",
  payment_received: "Payment Received",
  assigned_technicians: "Assigned Technicians",
};

export default function ProjectChangeHistoryModal({ open, onClose, projectId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['projectChangeHistory', projectId],
    queryFn: () => base44.entities.ChangeHistory.filter({ project_id: projectId }, '-created_date'),
    enabled: open && !!projectId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Change History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-lg p-4 h-20" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No changes recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((change) => (
                <div key={change.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-sm text-slate-900">
                        {change.changed_by_name || change.changed_by}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {format(new Date(change.created_date), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="font-medium text-slate-700">
                      {fieldLabels[change.field_name] || change.field_name}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      {change.old_value && (
                        <>
                          <span className="text-slate-500 line-through">{change.old_value}</span>
                          <span className="text-slate-400">→</span>
                        </>
                      )}
                      <span className="text-slate-900">{change.new_value || '(empty)'}</span>
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