import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, ExternalLink, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";

const invoiceStatusColors = {
  "Draft": "bg-slate-100 text-slate-700 border-slate-200",
  "Submitted": "bg-blue-100 text-blue-700 border-blue-200",
  "Authorised": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Paid": "bg-green-100 text-green-700 border-green-200",
  "Voided": "bg-red-100 text-red-700 border-red-200"
};

export default function XeroInvoiceCard({ invoice, onRefreshStatus, onViewInXero, isRefreshing }) {
  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#4B5563] flex-shrink-0" />
              <h4 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
                Invoice #{invoice.xero_invoice_number}
              </h4>
            </div>
            <Badge className={`${invoiceStatusColors[invoice.status]} font-semibold text-[11px] px-2.5 py-0.5 rounded-lg border`}>
              {invoice.status}
            </Badge>
          </div>
          
          <div className="text-right">
            <div className="text-[12px] text-[#6B7280] mb-1">Total</div>
            <div className="text-[18px] font-bold text-[#111827]">
              ${invoice.total_amount?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          {invoice.amount_due > 0 && (
            <div>
              <div className="text-[12px] text-[#6B7280] mb-0.5">Amount Due</div>
              <div className="text-[14px] font-semibold text-[#111827]">
                ${invoice.amount_due.toFixed(2)}
              </div>
            </div>
          )}
          {invoice.amount_paid > 0 && (
            <div>
              <div className="text-[12px] text-[#6B7280] mb-0.5">Paid</div>
              <div className="text-[14px] font-semibold text-green-600">
                ${invoice.amount_paid.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[#6B7280] mb-3">
          <Calendar className="w-3 h-3" />
          <span>
            Issued {invoice.issue_date && format(new Date(invoice.issue_date), 'MMM d, yyyy')}
            {invoice.due_date && ` • Due ${format(new Date(invoice.due_date), 'MMM d, yyyy')}`}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onViewInXero}
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-sm border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          >
            <ExternalLink className="w-4 h-4 mr-1.5" />
            View in Xero
          </Button>
          <Button
            onClick={onRefreshStatus}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="h-9 px-3 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}