import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TakePaymentModal({ 
  open, 
  onClose,
  invoice
}) {
  const handlePayOnXero = () => {
    // Open Xero's online invoice payment portal
    const paymentUrl = invoice?.online_invoice_url || invoice?.pdf_url;
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-2 border-[#E5E7EB]">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            Payment Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#6B7280]">Invoice</span>
              <span className="font-semibold text-[#111827]">#{invoice?.xero_invoice_number}</span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#6B7280]">Customer</span>
              <span className="font-semibold text-[#111827]">{invoice?.customer_name}</span>
            </div>
            <div className="flex items-center justify-between text-[14px] pt-2 border-t border-[#E5E7EB]">
              <span className="font-semibold text-[#111827]">Amount Due</span>
              <span className="font-bold text-[#111827] text-base">${invoice?.amount_due?.toFixed(2)}</span>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-[14px] text-blue-900 leading-relaxed">
              <strong>Secure Payment via Xero:</strong> Opens Xero's secure payment portal where you can collect payment using a card reader or have the customer pay online. All card details are handled directly by Xero.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayOnXero}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Xero Payment Portal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}