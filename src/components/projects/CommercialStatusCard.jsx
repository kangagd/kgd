import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, ChevronRight } from "lucide-react";

function toTs(v) {
  if (!v) return 0;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function CommercialStatusCard({
  project,
  quotes = [],
  invoices,
  xeroInvoices,
  onNavigateToTab,
}) {
  const quoteList = Array.isArray(quotes) ? quotes : [];
  const invoiceList = Array.isArray(invoices)
    ? invoices
    : Array.isArray(xeroInvoices)
    ? xeroInvoices
    : [];

  const sortedQuotes = useMemo(() => {
    if (!quoteList.length) return [];
    return [...quoteList].sort((a, b) => {
      // Use most recent activity timestamp in order: accepted → viewed → sent → created
      const aTime = toTs(a?.accepted_at) || toTs(a?.viewed_at) || toTs(a?.sent_at) || toTs(a?.created_at);
      const bTime = toTs(b?.accepted_at) || toTs(b?.viewed_at) || toTs(b?.sent_at) || toTs(b?.created_at);
      return bTime - aTime;
    });
  }, [quoteList]);

  const totalInvoiced = invoiceList.reduce(
    (sum, inv) => sum + (Number(inv?.total_amount) || 0),
    0
  );
  const totalPaid = invoiceList.reduce(
    (sum, inv) => sum + (Number(inv?.amount_paid) || 0),
    0
  );
  const balanceDue = totalInvoiced - totalPaid;

  const depositThreshold = totalInvoiced * 0.4;
  const depositPaid = totalPaid >= depositThreshold && totalPaid < totalInvoiced;
  const fullyPaid = totalPaid >= totalInvoiced && totalInvoiced > 0;

  const quoteColors = {
    Draft: "bg-slate-100 text-slate-700",
    Sent: "bg-blue-100 text-blue-700",
    Viewed: "bg-purple-100 text-purple-700",
    Accepted: "bg-green-100 text-green-700",
    Declined: "bg-red-100 text-red-700",
    Expired: "bg-orange-100 text-orange-700",
  };

  const invoiceBadgeClass = (status) => {
    if (status === "PAID") return "bg-green-100 text-green-700";
    if (status === "OVERDUE") return "bg-red-100 text-red-700";
    if (!status || status === "UNKNOWN") return "bg-slate-100 text-slate-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">
          Commercial Status
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Quote Status */}
        {sortedQuotes.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.("quoting");
            }}
            className="w-full flex items-col p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#4B5563]">
                  Quotes
                </span>
              </div>

              <div className="space-y-1.5 ml-6">
                {sortedQuotes.map((quote, idx) => {
                  const label =
                    quote?.name ||
                    quote?.title ||
                    quote?.quote_number ||
                    `Quote ${idx + 1}`;
                  const status = quote?.status || "Unknown";
                  return (
                    <div
                      key={quote?.id || `${idx}`}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-[#6B7280]">{label}</span>
                      <Badge
                        className={
                          quoteColors[status] || "bg-slate-100 text-slate-700"
                        }
                      >
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] mt-1" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.("quoting");
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
        {invoiceList.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.("invoices");
            }}
            className="w-full flex items-col p-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors text-left group border-t border-[#E5E7EB] pt-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#4B5563]">
                  Invoices
                </span>
              </div>

              <div className="space-y-1.5 ml-6">
                {invoiceList.map((inv, idx) => {
                  const number =
                    inv?.xero_invoice_number ||
                    inv?.invoice_number ||
                    inv?.number ||
                    "N/A";
                  const status = inv?.status || inv?.xero_status || "UNKNOWN";
                  return (
                    <div
                      key={inv?.id || `${idx}`}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-[#6B7280]">#{number}</span>
                      <Badge className={invoiceBadgeClass(status)}>
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] mt-1" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.("invoices");
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