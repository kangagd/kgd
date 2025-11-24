import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, DollarSign, Eye, Edit, Copy, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { StatusBadge } from "../components/common/StatusBadge";
import QuoteForm from "../components/quotes/QuoteForm";
import QuoteDetails from "../components/quotes/QuoteDetails";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Quotes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");

  const quoteId = searchParams.get("quoteId");
  const action = searchParams.get("action");

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list('-created_date')
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const createQuoteMutation = useMutation({
    mutationFn: (data) => base44.entities.Quote.create(data),
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSearchParams({ quoteId: newQuote.id });
    }
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Quote.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSearchParams({});
    }
  });

  const filteredQuotes = allQuotes.filter(quote => {
    const matchesSearch = !searchTerm || 
      quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateQuote = (quoteData) => {
    createQuoteMutation.mutate(quoteData);
  };

  const handleUpdateQuote = (quoteData) => {
    const selectedQuote = allQuotes.find(q => q.id === quoteId);
    if (selectedQuote) {
      updateQuoteMutation.mutate({ id: selectedQuote.id, data: quoteData });
    }
  };

  const handleCancel = () => {
    setSearchParams({});
  };

  if (action === "new") {
    return (
      <div className="p-4 md:p-6 bg-[#ffffff] min-h-screen">
        <QuoteForm
          onSubmit={handleCreateQuote}
          onCancel={handleCancel}
          isSubmitting={createQuoteMutation.isPending}
          projects={projects}
          customers={customers}
          jobs={jobs}
        />
      </div>
    );
  }

  if (quoteId) {
    const selectedQuote = allQuotes.find(q => q.id === quoteId);
    if (selectedQuote) {
      return (
        <div className="p-4 md:p-6 bg-[#ffffff] min-h-screen">
          <QuoteDetails
            quote={selectedQuote}
            onUpdate={handleUpdateQuote}
            onCancel={handleCancel}
            onDelete={() => {
              if (confirm('Are you sure you want to delete this draft quote?')) {
                deleteQuoteMutation.mutate(selectedQuote.id);
              }
            }}
            projects={projects}
            customers={customers}
          />
        </div>
      );
    }
  }

  return (
    <div className="p-4 md:p-6 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Quotes</h1>
            <p className="text-sm text-[#6B7280] mt-1">Create and manage customer quotes</p>
          </div>
          <Button
            onClick={() => setSearchParams({ action: "new" })}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Draft">Draft</TabsTrigger>
                <TabsTrigger value="Sent">Sent</TabsTrigger>
                <TabsTrigger value="Viewed">Viewed</TabsTrigger>
                <TabsTrigger value="Accepted">Accepted</TabsTrigger>
                <TabsTrigger value="Declined">Declined</TabsTrigger>
                <TabsTrigger value="Expired">Expired</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {filteredQuotes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E5E7EB]">
            <FileText className="w-16 h-16 text-[#D1D5DB] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#111827] mb-2">No quotes found</h3>
            <p className="text-[#6B7280] mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first quote"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button
                onClick={() => setSearchParams({ action: "new" })}
                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Quote
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                onClick={() => setSearchParams({ quoteId: quote.id })}
                className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-[#6B7280]">
                        {quote.quote_number}
                      </span>
                      <StatusBadge type="quoteStatus" value={quote.status} />
                    </div>
                    <h3 className="font-semibold text-[#111827] mb-1 truncate">
                      {quote.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B7280]">
                      <span>{quote.customer_name}</span>
                      {quote.project_title && (
                        <>
                          <span>•</span>
                          <span>{quote.project_title}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-2xl font-bold text-[#111827]">
                      ${(quote.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {quote.issue_date ? format(parseISO(quote.issue_date), 'MMM d, yyyy') : 'No date'}
                      </span>
                    </div>
                    {quote.expiry_date && (
                      <div className="text-xs text-[#6B7280]">
                        Expires: {format(parseISO(quote.expiry_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}