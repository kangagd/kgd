import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  "Draft": "bg-slate-100 text-slate-800",
  "Sent": "bg-blue-100 text-blue-800",
  "Paid": "bg-green-100 text-green-800",
  "Overdue": "bg-red-100 text-red-800",
  "Cancelled": "bg-gray-100 text-gray-800"
};

export default function InvoiceList({ invoices, onSelectInvoice }) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-[#6B7280]">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map(invoice => (
        <Card
          key={invoice.id}
          className="hover:shadow-md transition-all cursor-pointer hover:border-[#FAE008]"
          onClick={() => onSelectInvoice(invoice)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-[#111827]">{invoice.invoice_number}</h4>
                  <Badge className={statusColors[invoice.status]}>
                    {invoice.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-[#6B7280]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                      {invoice.due_date && ` • Due ${format(new Date(invoice.due_date), 'MMM d, yyyy')}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#111827]">
                  ${invoice.total.toFixed(2)}
                </div>
                <div className="text-xs text-[#6B7280]">
                  inc. GST
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}