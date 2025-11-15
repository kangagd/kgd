import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function CheckOutDialog({ open, onClose, job, onConfirm, isSubmitting }) {
  const [outcome, setOutcome] = useState(job?.outcome || "");
  const [errors, setErrors] = useState([]);

  const validateCheckout = () => {
    const newErrors = [];
    
    if (!job.additional_info || job.additional_info.trim() === "") {
      newErrors.push("Additional Information must be filled out before checking out");
    }
    
    if (!job.image_urls || job.image_urls.length === 0) {
      newErrors.push("At least one photo must be added before checking out");
    }
    
    if (!outcome) {
      newErrors.push("An outcome must be selected");
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleConfirm = () => {
    if (validateCheckout()) {
      onConfirm(outcome);
    }
  };

  const checks = [
    {
      label: "Additional Info",
      passed: job?.additional_info && job.additional_info.trim() !== "",
    },
    {
      label: "Photos Added",
      passed: job?.image_urls && job.image_urls.length > 0,
    },
    {
      label: "Outcome Selected",
      passed: !!outcome,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check Out of Job</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Pre-Check Requirements</h4>
            <div className="space-y-2">
              {checks.map((check, index) => (
                <div key={index} className="flex items-center gap-2">
                  {check.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className={`text-sm ${check.passed ? 'text-green-700' : 'text-amber-700'}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Job Outcome *</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_quote">New Quote</SelectItem>
                <SelectItem value="update_quote">Update Quote</SelectItem>
                <SelectItem value="send_invoice">Send Invoice</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="return_visit_required">Return Visit Required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? 'Checking Out...' : 'Confirm Check Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}