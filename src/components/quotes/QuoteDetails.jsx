import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Eye, Copy, Archive, Plus, Trash2, Edit } from "lucide-react";
import { StatusBadge } from "../common/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QuoteItemManager from "./QuoteItemManager";
import QuoteTimeline from "./QuoteTimeline";

export default function QuoteDetails({ quote, onUpdate, onCancel, projects, customers }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("items");

  const { data: quoteItems = [] } = useQuery({
    queryKey: ['quoteItems', quote.id],
    queryFn: () => base44.entities.QuoteItem.filter({ quote_id: quote.id })
  });

  const { data: quoteSections = [] } = useQuery({
    queryKey: ['quoteSections', quote.id],
    queryFn: () => base44.entities.QuoteSection.filter({ quote_id: quote.id })
  });

  const { data: quoteEvents = [] } = useQuery({
    queryKey: ['quoteEvents', quote.id],
    queryFn: () => base44.entities.QuoteEvent.filter({ quote_id: quote.id })
  });

  const { data: quoteSignatures = [] } = useQuery({
    queryKey: ['quoteSignatures', quote.id],
    queryFn: () => base44.entities.QuoteSignature.filter({ quote_id: quote.id })
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteEvents', quote.id] });
    }
  });

  const handleSendQuote = async () => {
    await onUpdate({ ...quote, status: "Sent" });
    createEventMutation.mutate({
      quote_id: quote.id,
      event_type: "sent",
      occurred_at: new Date().toISOString(),
      metadata: JSON.stringify({ method: "manual" })
    });
  };

  const handlePreview = () => {
    const publicUrl = `${window.location.origin}/PublicQuote?token=${quote.public_share_token}`;
    window.open(publicUrl, '_blank');
  };

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/PublicQuote?token=${quote.public_share_token}`;
    navigator.clipboard.writeText(publicUrl);
  };

  const customer = customers.find(c => c.id === quote.customer_id);
  const project = projects.find(p => p.id === quote.project_id);

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onCancel}
                className="hover:bg-[#F3F4F6]"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm text-[#6B7280]">{quote.quote_number}</span>
                  <StatusBadge type="quoteStatus" value={quote.status} />
                </div>
                <CardTitle className="text-xl font-semibold text-[#111827]">
                  {quote.title}
                </CardTitle>
              </div>
            </div>
            <div className="flex gap-2">
              {quote.status === "Draft" && (
                <Button
                  onClick={handleSendQuote}
                  className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handlePreview}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="bg-[#F9FAFB] border border-[#E5E7EB]">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-[#111827] mb-3">Customer</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#6B7280]">Name: </span>
                      <span className="text-[#111827] font-medium">{quote.customer_name}</span>
                    </div>
                    {quote.customer_email && (
                      <div>
                        <span className="text-[#6B7280]">Email: </span>
                        <span className="text-[#111827]">{quote.customer_email}</span>
                      </div>
                    )}
                    {quote.customer_phone && (
                      <div>
                        <span className="text-[#6B7280]">Phone: </span>
                        <span className="text-[#111827]">{quote.customer_phone}</span>
                      </div>
                    )}
                    {project && (
                      <div>
                        <span className="text-[#6B7280]">Project: </span>
                        <span className="text-[#111827] font-medium">{project.title}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border border-[#E5E7EB]">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-[#111827] mb-3">Quote Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-[#6B7280]">Issue Date: </span>
                    <span className="text-[#111827]">{quote.issue_date}</span>
                  </div>
                  {quote.expiry_date && (
                    <div>
                      <span className="text-[#6B7280]">Expiry: </span>
                      <span className="text-[#111827]">{quote.expiry_date}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-[#E5E7EB]">
                    <div className="text-2xl font-bold text-[#111827]">
                      ${(quote.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-1">Total Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="signature">Signature</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="mt-6">
              <QuoteItemManager 
                quote={quote}
                quoteItems={quoteItems}
                quoteSections={quoteSections}
                onUpdate={onUpdate}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-6">
              <QuoteTimeline events={quoteEvents} />
            </TabsContent>

            <TabsContent value="signature" className="mt-6">
              {quoteSignatures.length > 0 ? (
                <Card className="bg-white border border-[#E5E7EB]">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-[#111827] mb-4">Quote Accepted</h3>
                    {quoteSignatures.map((sig) => (
                      <div key={sig.id} className="space-y-2 text-sm">
                        <div>
                          <span className="text-[#6B7280]">Signed by: </span>
                          <span className="text-[#111827] font-medium">{sig.signer_name}</span>
                        </div>
                        <div>
                          <span className="text-[#6B7280]">Email: </span>
                          <span className="text-[#111827]">{sig.signer_email}</span>
                        </div>
                        <div>
                          <span className="text-[#6B7280]">Signed at: </span>
                          <span className="text-[#111827]">{new Date(sig.signed_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
                  <p className="text-[#6B7280]">No signature yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}