import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, ChevronRight } from "lucide-react";

export default function CommercialStatusCard({ project, quotes = [], invoices = [], onNavigateToTab }) {
  // Show all quotes, ordered by most recent activity
  const sortedQuotes = quotes.length > 0 
    ? [...quotes].sort((a, b) => {
        const aTime = new Date(a.sent_at || a.updated_date || a.created_date);
        const bTime = new Date(b.sent_at || b.updated_date || b.created_date);
        return bTime - aTime;
      })
    : [];
  
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
    "Accepted": "bg-green-100 text-green-700",
    "Declined": "bg-red-100 text-red-700",
    "Expired": "bg-orange-100 text-orange-700"
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Commercial Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Quote Status */}
        {sortedQuotes.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.('quoting');
            }}
            className="w-full flex items-col p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#4B5563]">Quotes</span>
              </div>
              
              <div className="space-y-1.5 ml-6">
                {sortedQuotes.map((quote, idx) => (
                  <div key={quote.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-[#6B7280]">{quote.name || `Quote ${idx + 1}`}</span>
                    <Badge className={quoteColors[quote.status] || "bg-slate-100 text-slate-700"}>
                      {quote.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] mt-1" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.('quoting');
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[14px] text-[#9CA3AF]">No quotes yet</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280]" />
          </button>
        )}

        {/* Invoice Status */}
        {invoices.length > 0 ? (
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
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-[#6B7280]">#{inv.xero_invoice_number || 'N/A'}</span>
                    <Badge className={inv.status === 'PAID' ? 'bg-green-100 text-green-700' : inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                      {inv.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] mt-1" />
          </button>
        ) : (
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