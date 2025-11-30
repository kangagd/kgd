import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Link2, ExternalLink, Copy, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuoteStatusBadge } from "../common/StatusBadge";
import CreateQuoteModal from "../quotes/CreateQuoteModal";
import LinkQuoteModal from "../quotes/LinkQuoteModal";
import AccessDenied from "../common/AccessDenied";

export default function ProjectQuotesTab({ project, user }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const queryClient = useQueryClient();

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const isTechnician = user?.is_field_technician && !isAdminOrManager;

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['projectQuotes', project.id],
    queryFn: async () => {
      const data = await base44.entities.Quote.filter({ project_id: project.id }, '-created_date');
      return data;
    },
    enabled: !!project.id
  });

  const filteredQuotes = isTechnician 
    ? quotes.filter(q => q.status === 'Accepted') 
    : quotes;

  const handleQuoteCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['projectQuotes', project.id] });
    queryClient.invalidateQueries({ queryKey: ['project', project.id] }); // Refresh project for summary counts
  };

  // Function to get public link
  const getPublicLink = useCallback(async (quote) => {
    if (quote.pandadoc_public_url) return quote.pandadoc_public_url;
    
    // If not cached, try to fetch session link
    try {
        const recipientEmail = quote.customer_email || project.customer_email;
        if (!recipientEmail) {
            toast.error("No recipient email found to generate link");
            return null;
        }
        const response = await base44.functions.invoke('getPandaDocSessionLink', {
            documentId: quote.pandadoc_document_id,
            recipientEmail: recipientEmail
        });
        if (response.data?.public_url) {
            return response.data.public_url;
        }
    } catch (err) {
        console.error("Error fetching public link", err);
    }
    return null;
  }, [project.customer_email]);

  const handleViewAsClient = async (quote) => {
      const url = await getPublicLink(quote);
      if (url) {
          window.open(url, '_blank');
      } else {
          toast.error("Could not generate client link");
      }
  };

  const handleCopyLink = async (quote) => {
      const url = await getPublicLink(quote);
      if (url) {
          navigator.clipboard.writeText(url);
          toast.success("Link copied to clipboard");
      } else {
          toast.error("Could not generate client link");
      }
  };

  if (isLoading) {
      return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions - Hidden for Technicians */}
      {isAdminOrManager && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Project Quotes</h3>
            <p className="text-sm text-slate-500">Manage PandaDoc quotes for this project</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowLinkModal(true)}>
              <Link2 className="w-4 h-4 mr-2" />
              Link Existing Quote
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]">
              <Plus className="w-4 h-4 mr-2" />
              Create Quote in PandaDoc
            </Button>
          </div>
        </div>
      )}

      {/* Quotes Table */}
      <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Quote Name / Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No quotes found
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-[#111827]">
                    <div className="flex flex-col">
                        <span>{quote.name}</span>
                        {quote.quote_number && <span className="text-xs text-slate-500">#{quote.quote_number}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge value={quote.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                        {quote.currency} ${(quote.value || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                        <span>{new Date(quote.created_date).toLocaleDateString()}</span>
                        {quote.sent_at && <span className="text-xs text-slate-500">Sent: {new Date(quote.sent_at).toLocaleDateString()}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAdminOrManager && quote.pandadoc_internal_url && (
                        <Button variant="ghost" size="icon" title="Open in PandaDoc" onClick={() => window.open(quote.pandadoc_internal_url, '_blank')}>
                          <ExternalLink className="w-4 h-4 text-slate-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="View as Client" onClick={() => handleViewAsClient(quote)}>
                        <Eye className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Copy Client Link" onClick={() => handleCopyLink(quote)}>
                        <Copy className="w-4 h-4 text-slate-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      {isAdminOrManager && (
        <>
          <CreateQuoteModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            project={project}
            customer={{ id: project.customer_id, name: project.customer_name, email: project.customer_email }} // Pass customer context
            onQuoteCreated={handleQuoteCreated}
          />
          <LinkQuoteModal
            isOpen={showLinkModal}
            onClose={() => setShowLinkModal(false)}
            project={project}
            onQuoteLinked={handleQuoteCreated}
          />
        </>
      )}
    </div>
  );
}