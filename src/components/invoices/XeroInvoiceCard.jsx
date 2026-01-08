import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, ExternalLink, RefreshCw, Calendar, Download, CheckCircle2, AlertCircle, Clock, CreditCard, FolderKanban, Link2 } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { sameId } from "@/components/utils/id";

const invoiceStatusColors = {
  "Draft": "bg-slate-100 text-slate-700 border-slate-200",
  "Submitted": "bg-blue-100 text-blue-700 border-blue-200",
  "Authorised": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Paid": "bg-green-100 text-green-700 border-green-200",
  "Voided": "bg-red-100 text-red-700 border-red-200"
};

const getPaymentStatus = (invoice) => {
  const amountDue = invoice.amount_due || 0;
  const amountPaid = invoice.amount_paid || 0;
  const total = invoice.total_amount || 0;

  if (amountDue === 0 && amountPaid >= total) {
    return { label: 'Paid', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
  } else if (amountPaid > 0 && amountDue > 0) {
    return { label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock };
  } else {
    return { label: 'Owed', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
  }
};

export default function XeroInvoiceCard({ invoice, onRefreshStatus, onViewInXero, onDownloadPdf, onTakePayment, isRefreshing, isDownloading, currentProjectId }) {
  const paymentStatus = getPaymentStatus(invoice);
  const PaymentIcon = paymentStatus.icon;
  const navigate = useNavigate();
  
  // Check if invoice is linked to a different project using sameId helper
  const isDifferentProject = currentProjectId && invoice.project_id && !sameId(invoice.project_id, currentProjectId);

  return (
    <Card className={`border shadow-sm rounded-lg ${isDifferentProject ? 'border-amber-300 bg-amber-50/30' : 'border-[#E5E7EB]'}`}>
      <CardContent className="p-4">
        {isDifferentProject && (
          <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-800 font-medium">Linked to different project</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${createPageUrl("Projects")}?projectId=${invoice.project_id}`);
                }}
                className="text-xs text-amber-700 hover:text-amber-900 underline flex items-center gap-1 mt-1"
              >
                <Link2 className="w-3 h-3" />
                View linked project
              </button>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#4B5563] flex-shrink-0" />
              <h4 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
                Invoice #{invoice.xero_invoice_number}
              </h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${invoiceStatusColors[invoice.status]} font-semibold text-[11px] px-2.5 py-0.5 rounded-lg border`}>
                {invoice.status}
              </Badge>
              <Badge className={`${paymentStatus.color} font-semibold text-[11px] px-2.5 py-0.5 rounded-lg border flex items-center gap-1`}>
                <PaymentIcon className="w-3 h-3" />
                {paymentStatus.label}
              </Badge>
            </div>
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
            {(() => {
              try {
                const issueDate = invoice.issue_date ? new Date(invoice.issue_date) : null;
                const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
                const issueDateValid = issueDate && !isNaN(issueDate.getTime());
                const dueDateValid = dueDate && !isNaN(dueDate.getTime());
                
                let text = '';
                if (issueDateValid) {
                  text = `Issued ${format(issueDate, 'MMM d, yyyy')}`;
                }
                if (dueDateValid) {
                  text += issueDateValid ? ` • Due ${format(dueDate, 'MMM d, yyyy')}` : `Due ${format(dueDate, 'MMM d, yyyy')}`;
                }
                return text || 'No date available';
              } catch {
                return 'Date unavailable';
              }
            })()}
          </span>
        </div>

        <div className="space-y-2">
          {invoice.amount_due > 0 && onTakePayment && (
            <>
              <Button
                onClick={onTakePayment}
                disabled={!invoice.online_payment_url}
                className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FAE008]"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                {invoice.online_payment_url ? 'Pay Securely Online' : 'No Public Link'}
              </Button>
              {!invoice.online_payment_url && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ⚠️ Public payment link not available. Try syncing the invoice status.
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <Button
              onClick={onViewInXero}
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-sm border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
              title="Admin view - opens in Xero dashboard"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              View in Xero
            </Button>
            <Button
              onClick={onDownloadPdf}
              variant="outline"
              size="sm"
              disabled={isDownloading}
              className="h-9 px-3 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-pulse' : ''}`} />
            </Button>
            <Button
              onClick={onRefreshStatus}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              className="h-9 px-3 border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
              title="Sync payment status from Xero"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}