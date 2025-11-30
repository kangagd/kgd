import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, RefreshCw, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import XeroInvoiceCard from "../invoices/XeroInvoiceCard";
import CreateInvoiceModal from "../invoices/CreateInvoiceModal";
import LinkInvoiceModal from "../invoices/LinkInvoiceModal";

export default function ProjectInvoicesTab({ project, user }) {
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showLinkInvoice, setShowLinkInvoice] = useState(false);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', project.id],
    queryFn: async () => {
      return await base44.entities.XeroInvoice.filter({ project_id: project.id }, '-issued_at');
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('createXeroInvoiceFromProjectOrJob', data),
    onSuccess: (res) => {
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Invoice created in Xero');
        setShowCreateInvoice(false);
        queryClient.invalidateQueries(['invoices', project.id]);
      }
    },
    onError: () => toast.error('Failed to create invoice')
  });

  const linkInvoiceMutation = useMutation({
    mutationFn: (invoiceId) => base44.functions.invoke('linkXeroInvoiceToProject', { 
        projectId: project.id, 
        xeroInvoiceId: invoiceId 
    }),
    onSuccess: () => {
        toast.success('Invoice linked');
        setShowLinkInvoice(false);
        queryClient.invalidateQueries(['invoices', project.id]);
    },
    onError: () => toast.error('Failed to link invoice')
  });

  const syncInvoiceMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('syncXeroInvoiceStatus', { xero_invoice_id: id }),
    onSuccess: () => {
      toast.success('Invoice synced');
      queryClient.invalidateQueries(['invoices', project.id]);
    }
  });

  const handleCreateInvoice = (data) => {
    createInvoiceMutation.mutate({
      projectId: project.id,
      lineItems: data.lineItems
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#111827] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FAE008]" />
          Xero Invoices ({invoices.length})
        </h3>
        <div className="flex gap-2">
            <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowLinkInvoice(true)}
            >
                <LinkIcon className="w-4 h-4 mr-2" />
                Link Existing
            </Button>
            <Button 
                size="sm" 
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                onClick={() => setShowCreateInvoice(true)}
            >
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
            </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="bg-white p-3 rounded-full inline-block mb-3 shadow-sm">
            <FileText className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 mb-4">No invoices created for this project yet.</p>
          <Button onClick={() => setShowCreateInvoice(true)}>Create First Invoice</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {invoices.map(invoice => (
            <XeroInvoiceCard
              key={invoice.id}
              invoice={invoice}
              onRefreshStatus={() => syncInvoiceMutation.mutate(invoice.xero_invoice_id)}
              isRefreshing={syncInvoiceMutation.isPending}
              onDownloadPdf={() => window.open(invoice.xero_public_url, '_blank')} 
            />
          ))}
        </div>
      )}

      <CreateInvoiceModal
        open={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        onConfirm={handleCreateInvoice}
        isSubmitting={createInvoiceMutation.isPending}
        type="project"
        data={project}
      />

      <LinkInvoiceModal
        open={showLinkInvoice}
        onClose={() => setShowLinkInvoice(false)}
        onLink={(invoice) => linkInvoiceMutation.mutate(invoice.id)}
        isSubmitting={linkInvoiceMutation.isPending}
      />
    </div>
  );
}