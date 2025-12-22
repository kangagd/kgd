import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, CheckCircle2 } from "lucide-react";

export default function CommercialStatusCard({ project, quotes = [], invoices = [] }) {
  // Quote status
  const primaryQuote = quotes.find(q => q.id === project.primary_quote_id) || quotes[0];
  const quoteStatus = primaryQuote?.status || "Not sent";
  
  // Financial status
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const balanceDue = totalInvoiced - totalPaid;

  const quoteColors = {
    "Draft": "bg-slate-100 text-slate-700",
    "Sent": "bg-blue-100 text-blue-700",
    "Viewed": "bg-purple-100 text-purple-700",
    "Approved": "bg-green-100 text-green-700",
    "Declined": "bg-red-100 text-red-700",
    "Not sent": "bg-slate-100 text-slate-500"
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Commercial Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quote Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[14px] text-[#4B5563]">Quote</span>
          </div>
          <Badge className={quoteColors[quoteStatus] || "bg-slate-100 text-slate-700"}>
            {quoteStatus}
          </Badge>
        </div>

        {/* Financial Summary */}
        {invoices.length > 0 && (
          <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[14px] font-medium text-[#4B5563]">Financials</span>
            </div>
            
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6B7280]">Invoiced</span>
              <span className="font-medium text-[#111827]">${totalInvoiced.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6B7280]">Paid</span>
              <span className="font-medium text-green-700">${totalPaid.toFixed(2)}</span>
            </div>
            
            {balanceDue > 0 && (
              <div className="flex justify-between text-[13px] pt-2 border-t border-[#E5E7EB]">
                <span className="text-[#6B7280] font-medium">Balance Due</span>
                <span className="font-semibold text-[#111827]">${balanceDue.toFixed(2)}</span>
              </div>
            )}
            
            {balanceDue === 0 && totalInvoiced > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB] text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[13px] font-medium">Fully Paid</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}