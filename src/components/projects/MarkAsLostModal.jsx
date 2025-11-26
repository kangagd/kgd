import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";

const LOST_REASONS = [
  { value: "No longer required", label: "No longer required" },
  { value: "Proceeded with competitor", label: "Proceeded with competitor" },
  { value: "Pricing", label: "Pricing" },
  { value: "Out of scope", label: "Out of scope" },
  { value: "Unresponsive", label: "Unresponsive" },
  { value: "Other", label: "Other" },
];

export default function MarkAsLostModal({ open, onClose, onConfirm, openJobsCount, isSubmitting }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm({
      lost_reason: reason,
      lost_reason_notes: notes,
      lost_date: new Date().toISOString().split('T')[0]
    });
  };

  const handleClose = () => {
    setReason("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Mark Project as Lost
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {openJobsCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[13px] text-amber-800">
                <strong>Note:</strong> {openJobsCount} open job{openJobsCount > 1 ? 's' : ''} will be automatically cancelled.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-[14px] font-medium text-[#111827]">
              Lost Reason <span className="text-red-500">*</span>
            </Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {LOST_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label 
                    htmlFor={r.value} 
                    className="text-[14px] text-[#4B5563] cursor-pointer font-normal"
                  >
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === "Other" && (
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#111827]">
                Please specify <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter the reason..."
                className="min-h-[80px]"
              />
            </div>
          )}

          {reason && reason !== "Other" && (
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#111827]">
                Additional Notes (optional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context..."
                className="min-h-[60px]"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason || (reason === "Other" && !notes) || isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? "Marking as Lost..." : "Mark as Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}