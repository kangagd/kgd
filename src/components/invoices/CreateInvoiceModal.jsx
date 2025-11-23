import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, User, Briefcase, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateInvoiceModal({ 
  open, 
  onClose, 
  onConfirm, 
  isSubmitting,
  type = "job", // "job" or "project"
  data = {}
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    onConfirm(numAmount);
  };

  const handleClose = () => {
    setAmount("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-2 border-[#E5E7EB]">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            Create Xero Invoice for this {type === "job" ? "Job" : "Project"}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-[#6B7280] mb-0.5">Customer</div>
                <div className="text-[14px] font-semibold text-[#111827]">{data.customer_name}</div>
                {data.customer_email && (
                  <div className="text-[12px] text-[#6B7280] mt-0.5">{data.customer_email}</div>
                )}
              </div>
            </div>

            {type === "job" && data.job_number && (
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[12px] text-[#6B7280] mb-0.5">Job Number</div>
                  <div className="text-[14px] font-semibold text-[#111827]">#{data.job_number}</div>
                </div>
              </div>
            )}

            {type === "project" && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[12px] text-[#6B7280] mb-0.5">Project</div>
                  <div className="text-[14px] font-semibold text-[#111827]">{data.title}</div>
                  {data.project_type && (
                    <div className="text-[12px] text-[#6B7280] mt-0.5">{data.project_type}</div>
                  )}
                </div>
              </div>
            )}

            {data.project_name && type === "job" && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[12px] text-[#6B7280] mb-0.5">Project Reference</div>
                  <div className="text-[14px] font-medium text-[#111827]">{data.project_name}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
              Invoice Amount *
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                className="pl-10 h-11 text-[15px] border-[#E5E7EB] focus:border-[#111827]"
                autoFocus
              />
            </div>
            <div className="text-[12px] text-[#6B7280] mt-1.5">
              This will create an authorised invoice in Xero
            </div>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-[14px] text-red-700 font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-[12px] text-blue-900 leading-relaxed">
              <strong>What happens next:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Invoice created in Xero (Authorised status)</li>
                <li>Customer can be emailed from Xero</li>
                <li>Payment tracking synced automatically</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
          >
            {isSubmitting ? 'Creating Invoice...' : 'Create & Send via Xero'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}