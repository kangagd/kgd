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
  isAdmin = false,
  isTechnician = false
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const queryClient = useQueryClient();

  // Build filter based on project or job
  // For jobs linked to projects, we want to show both job quotes AND project quotes
  const projectId = project?.id || job?.project_id;
  const jobId = job?.id;
  
  const filterKey = projectId 
    ? ['quotes', 'project', projectId, 'job', jobId || 'none'] 
    : jobId 
      ? ['quotes', 'job', jobId] 
      : ['quotes', 'none'];

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: filterKey,
    queryFn: async () => {
      let allQuotes = [];
      
      // If we have a project (either direct or via job), fetch project quotes
      if (projectId) {
        const allQuotesList = await base44.entities.Quote.list();
        const projectQuotes = allQuotesList.filter(q => q.project_id === projectId);
        allQuotes = [...projectQuotes];
      }
      
      // If we have a job, also fetch job-specific quotes
      if (jobId) {
        const allQuotesList = await base44.entities.Quote.list();
        const jobQuotes = allQuotesList.filter(q => q.job_id === jobId);
        // Add job quotes that aren't already in the list (avoid duplicates)
        jobQuotes.forEach(jq => {
          if (!allQuotes.find(q => q.id === jq.id)) {
            allQuotes.push(jq);
          }
        });
      }
      
      // Sort by created_date descending
      return allQuotes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!(projectId || jobId),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  const handleQuoteCreated = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
    // Refetch project data to update primary_quote_id and other fields
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  };

  const handleQuoteUpdate = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
    // Refetch project data
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  };

  // Function to get a fresh link from PandaDoc using Session API
  const getRefreshLink = useCallback(async (quote) => {
    if (!quote.pandadoc_document_id) return null;
    
    const recipientEmail = quote.customer_email || customer?.email || project?.customer_email || job?.customer_email;
    if (!recipientEmail) {
      toast.error('No customer email found for this quote');
      return null;
    }
    
    try {
      const response = await base44.functions.invoke('getPandaDocSessionLink', {
        documentId: quote.pandadoc_document_id,
        recipientEmail: recipientEmail
      });
      
      if (response.data?.error) {
        toast.error(response.data.error);
        return null;
      }
      
      return response.data?.public_url || null;
    } catch (error) {
      console.error('Failed to get link:', error);
      toast.error('Failed to get link');
      return null;
    }
  }, [customer, project, job]);

  // For technicians, show all quotes (read-only)
  const visibleQuotes = quotes;

  if (!projectId && !jobId) {
    return null;
  }

  // Technician view - compact read-only but clickable
  if (!isAdmin) {
    if (visibleQuotes.length === 0) {
      return null; 
    }

    return (
      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FAE008]" />
          Quotes
        </h3>
        <div className="space-y-2">
          {visibleQuotes.map((quote) => (
            <QuoteCard 
              key={quote.id} 
              quote={quote}
              isAdmin={false}
              isTechnician={isTechnician}
              isCompact={true}
              onSelect={setSelectedQuote}
              onRefreshLink={getRefreshLink}
            />
          ))}
        </div>
        
        <QuoteSummaryModal
          quote={selectedQuote}
          isOpen={!!selectedQuote}
          onClose={() => setSelectedQuote(null)}
          isAdmin={false}
          isTechnician={isTechnician}
          onRefreshLink={getRefreshLink}
        />
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
            onClick={(e) => {
              e.stopPropagation();
              setShowLinkModal(true);
            }}
            className="h-8 text-[13px]"
          >
            <Link2 className="w-3.5 h-3.5 mr-1" />
            Link Existing
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
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
              onRefreshLink={getRefreshLink}
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