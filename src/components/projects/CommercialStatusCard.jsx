import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CommercialStatusCard({ project, quotes = [], invoices = [], onNavigateToTab, onUpdateProject }) {
  // Quote status
  const primaryQuote = quotes.find(q => q.id === project.primary_quote_id) || quotes[0];
  const quoteStatus = primaryQuote?.status || "Draft";
  
  // Invoice status
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const balanceDue = totalInvoiced - totalPaid;
  
  // Determine deposit status (consider first 30-50% of total as deposit)
  const depositThreshold = totalInvoiced * 0.4;
  const depositPaid = totalPaid >= depositThreshold && totalPaid < totalInvoiced;
  const fullyPaid = totalPaid >= totalInvoiced && totalInvoiced > 0;

  const quoteColors = {
    "Draft": "bg-slate-100 text-slate-700",
    "Sent": "bg-blue-100 text-blue-700",
    "Viewed": "bg-purple-100 text-purple-700",
    "Approved": "bg-green-100 text-green-700",
    "Declined": "bg-red-100 text-red-700",
    "Expired": "bg-orange-100 text-orange-700"
  };

  const handleClientConfirmedToggle = async (checked) => {
    try {
      await base44.entities.Project.update(project.id, {
        client_confirmed: checked,
        client_confirmed_at: checked ? new Date().toISOString() : null
      });
      toast.success(checked ? 'Client confirmed' : 'Confirmation removed');
    } catch (error) {
      toast.error('Failed to update confirmation status');
    }
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Commercial Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Client Confirmed Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            {project.client_confirmed ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-[#9CA3AF]" />
            )}
            <span className="text-[14px] font-medium text-[#111827]">Client Confirmed</span>
          </div>
          <Switch
            checked={project.client_confirmed || false}
            onCheckedChange={handleClientConfirmedToggle}
          />
        </div>

        {/* Quote Status */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToTab?.('quoting');
          }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[14px] text-[#4B5563]">Quote</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={quoteColors[quoteStatus] || "bg-slate-100 text-slate-700"}>
              {quoteStatus}
            </Badge>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280]" />
          </div>
        </button>

        {/* Invoice Status */}
        {invoices.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.('invoices');
            }}
            className="w-full flex items-col p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group border-t border-[#E5E7EB] pt-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#4B5563]">Invoices</span>
              </div>
              
              <div className="space-y-1.5 ml-6">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#6B7280]">Deposit Paid</span>
                  <Badge variant={depositPaid || fullyPaid ? "default" : "secondary"} className={depositPaid || fullyPaid ? "bg-green-100 text-green-700" : ""}>
                    {depositPaid || fullyPaid ? "Yes" : "No"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#6B7280]">Balance Outstanding</span>
                  <Badge variant={balanceDue > 0 ? "default" : "secondary"} className={balanceDue > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}>
                    {balanceDue > 0 ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] mt-1" />
          </button>
        )}

        {invoices.length === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.('invoices');
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group border-t border-[#E5E7EB] pt-3"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[14px] text-[#9CA3AF]">No invoices yet</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280]" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}