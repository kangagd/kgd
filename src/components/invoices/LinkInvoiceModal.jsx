import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, Search, DollarSign, FileText, Calendar, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

const statusColors = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  AUTHORISED: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  VOIDED: "bg-red-100 text-red-700"
};

export default function LinkInvoiceModal({ open, onClose, onSelect, isSubmitting, currentInvoiceId, projectId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch invoices directly from Xero
  const { data: xeroData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['xeroInvoicesSearch', debouncedSearch],
    queryFn: async () => {
      const response = await base44.functions.invoke('searchXeroInvoices', { 
        search: debouncedSearch 
      });
      return response.data;
    },
    enabled: open
  });

  const invoices = xeroData?.invoices || [];

  // Also fetch linked invoices and jobs to check which are already linked
  const { data: linkedInvoices = [] } = useQuery({
    queryKey: ['linkedXeroInvoices'],
    queryFn: () => base44.entities.XeroInvoice.list(),
    enabled: open
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: open
  });

  // Create a map of linked invoice IDs that should be excluded
  // Only exclude if: linked to another project AND (not linked to a job OR job is not deleted)
  const linkedToOtherProjectIds = new Set(
    linkedInvoices
      .filter(inv => {
        // Allow if linked to current project
        if (inv.project_id === projectId) return false;
        
        // Allow if not linked to any project or job
        if (!inv.project_id && !inv.job_id) return false;
        
        // If linked to a job, check if that job is deleted
        if (inv.job_id) {
          const linkedJob = allJobs.find(j => j.id === inv.job_id);
          // If job is deleted, allow this invoice to be relinked
          if (linkedJob?.deleted_at) return false;
        }
        
        // Exclude if linked to another project and job is not deleted
        return inv.project_id && inv.project_id !== projectId;
      })
      .map(inv => inv.xero_invoice_id)
  );

  // Filter out invoices already linked to OTHER projects (allow current project's invoices)
  const availableInvoices = invoices.filter(inv => 
    !linkedToOtherProjectIds.has(inv.xero_invoice_id)
  );

  const handleSelect = (invoice) => {
    onSelect(invoice);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] rounded-2xl border-2 border-[#E5E7EB] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Existing Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-hidden flex-1 flex flex-col">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search by invoice number, customer, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-10 h-10 border-[#E5E7EB]"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#6B7280]" />
            )}
          </div>

          <p className="text-[12px] text-[#6B7280] flex-shrink-0">
            {xeroData?.total ? `Loaded ${xeroData.total} invoices from Xero` : 'Searching all invoices in Xero...'}
          </p>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
                <span className="ml-2 text-[14px] text-[#6B7280]">Loading from Xero...</span>
              </div>
            ) : xeroData?.error ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-red-300 mx-auto mb-2" />
                <p className="text-[14px] text-red-600 mb-2">Failed to load invoices from Xero</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              </div>
            ) : availableInvoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-[#E5E7EB] mx-auto mb-2" />
                <p className="text-[14px] text-[#6B7280]">
                  {searchTerm ? 'No matching invoices found' : 'No unlinked invoices available'}
                </p>
              </div>
            ) : (
              availableInvoices.map((invoice) => (
                <div
                  key={invoice.xero_invoice_id}
                  onClick={() => handleSelect(invoice)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-[#FAE008] hover:bg-[#FFFEF5] ${
                    invoice.xero_invoice_id === currentInvoiceId ? 'border-[#FAE008] bg-[#FFFEF5]' : 'border-[#E5E7EB]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#111827] text-[14px]">
                          #{invoice.xero_invoice_number}
                        </span>
                        <Badge className={`${statusColors[invoice.status] || 'bg-slate-100 text-slate-700'} text-[10px] font-medium`}>
                          {invoice.status}
                        </Badge>
                        {invoice.xero_invoice_id === currentInvoiceId && (
                          <Badge className="bg-green-100 text-green-700 text-[10px] font-medium">
                            Currently Linked
                          </Badge>
                        )}
                      </div>
                      <div className="text-[13px] text-[#4B5563] truncate">
                        {invoice.contact_name}
                      </div>
                      {invoice.reference && (
                        <div className="text-[12px] text-[#6B7280] truncate mt-0.5">
                          Ref: {invoice.reference}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-[#111827] text-[16px]">
                        ${invoice.total?.toFixed(2) || '0.00'}
                      </div>
                      {invoice.date && (
                        <div className="text-[11px] text-[#6B7280] flex items-center gap-1 justify-end mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {(() => {
                            try {
                              if (!invoice.date) return '-';
                              // Handle various date formats
                              let dateStr = invoice.date;
                              if (dateStr.includes('T')) {
                                dateStr = dateStr.split('T')[0];
                              }
                              // Validate date before parsing
                              const parsed = parseISO(dateStr);
                              if (isNaN(parsed.getTime())) return invoice.date;
                              return format(parsed, 'MMM d, yyyy');
                            } catch {
                              return invoice.date || '-';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 border-t border-[#E5E7EB] pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}