import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import QuoteCard from "./QuoteCard";
import CreateQuoteModal from "./CreateQuoteModal";

export default function QuotesSection({ 
  project = null, 
  job = null, 
  customer = null,
  isAdmin = false 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    enabled: !!(project?.id || job?.id)
  });

  const handleQuoteCreated = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
  };

  const handleQuoteUpdate = () => {
    queryClient.invalidateQueries({ queryKey: filterKey });
  };

  // For technicians, only show accepted quotes
  const visibleQuotes = isAdmin 
    ? quotes 
    : quotes.filter(q => q.status === 'Accepted');

  if (!project?.id && !job?.id) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FAE008]" />
          Quotes
        </h3>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Quote
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className="text-center py-8 bg-[#F9FAFB] rounded-lg border border-dashed border-[#E5E7EB]">
          <FileText className="w-8 h-8 mx-auto text-[#9CA3AF] mb-2" />
          <p className="text-[14px] text-[#6B7280]">
            {isAdmin ? 'No quotes yet. Create one using PandaDoc.' : 'No accepted quotes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleQuotes.map((quote) => (
            <QuoteCard 
              key={quote.id} 
              quote={quote} 
              onUpdate={handleQuoteUpdate}
              isAdmin={isAdmin}
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
    </div>
  );
}