import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2, Link2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import QuoteCard from "./QuoteCard";
import CreateQuoteModal from "./CreateQuoteModal";
import LinkQuoteModal from "./LinkQuoteModal";
import QuoteSummaryModal from "./QuoteSummaryModal";

export default function QuotesSection({ 
  project = null, 
  job = null, 
  customer = null,
  isAdmin = false 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const queryClient = useQueryClient();

  // Build filter based on project or job
  const filterKey = project?.id 
    ? ['quotes', 'project', project.id] 
    : job?.id 
      ? ['quotes', 'job', job.id] 
      : ['quotes', 'none'];

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: filterKey,
    queryFn: async () => {
      if (project?.id) {
        return await base44.entities.Quote.filter({ project_id: project.id }, '-created_date');
      } else if (job?.id) {
        return await base44.entities.Quote.filter({ job_id: job.id }, '-created_date');
      }
      return [];
    },
    enabled: !!(project?.id || job?.id),
    refetchInterval: 30000 // Refresh every 30s to catch webhook updates
  });

  const handleQuoteCreated = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
  };

  const handleQuoteUpdate = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
  };

  // Function to get a fresh session link from PandaDoc
  const getRefreshLink = useCallback(async (quote) => {
    if (!quote.pandadoc_document_id) return null;
    
    try {
      const response = await base44.functions.invoke('getPandaDocSessionLink', {
        documentId: quote.pandadoc_document_id,
        recipientEmail: quote.customer_email || ''
      });
      return response.data?.public_url || null;
    } catch (error) {
      console.error('Failed to get session link:', error);
      return null;
    }
  }, []);

  // For technicians, only show accepted quotes
  const visibleQuotes = isAdmin 
    ? quotes 
    : quotes.filter(q => q.status === 'Accepted');

  if (!project?.id && !job?.id) {
    return null;
  }

  // Technician view - compact read-only
  if (!isAdmin) {
    if (visibleQuotes.length === 0) {
      return null; // Don't show section at all for technicians if no accepted quotes
    }

    return (
      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FAE008]" />
          Accepted Quotes
        </h3>
        <div className="space-y-2">
          {visibleQuotes.map((quote) => (
            <QuoteCard 
              key={quote.id} 
              quote={quote}
              isAdmin={false}
              isCompact={true}
            />
          ))}
        </div>
      </div>
    );
  }

  // Admin view - full functionality
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FAE008]" />
          Quotes
          {quotes.length > 0 && (
            <span className="text-[12px] font-normal text-[#6B7280]">({quotes.length})</span>
          )}
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowLinkModal(true)}
            className="h-8 text-[13px]"
          >
            <Link2 className="w-3.5 h-3.5 mr-1" />
            Link Existing
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] h-8 text-[13px]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Quote in PandaDoc
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-10 bg-[#F9FAFB] rounded-lg border border-dashed border-[#E5E7EB]">
          <FileText className="w-10 h-10 mx-auto text-[#D1D5DB] mb-3" />
          <p className="text-[14px] text-[#6B7280] mb-4">
            No quotes yet for this {project ? 'project' : 'job'}.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Quote in PandaDoc
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <QuoteCard 
              key={quote.id} 
              quote={quote} 
              onUpdate={handleQuoteUpdate}
              onSelect={setSelectedQuote}
              isAdmin={true}
            />
          ))}
        </div>
      )}

      <CreateQuoteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        project={project}
        job={job}
        customer={customer}
        onQuoteCreated={handleQuoteCreated}
      />

      <LinkQuoteModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        project={project}
        job={job}
        onQuoteLinked={handleQuoteCreated}
      />

      <QuoteSummaryModal
        quote={selectedQuote}
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        isAdmin={true}
        onRefreshLink={getRefreshLink}
      />
    </div>
  );
}