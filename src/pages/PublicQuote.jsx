import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function PublicQuote() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  const [quote, setQuote] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: quoteData, isLoading } = useQuery({
    queryKey: ['publicQuote', token],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPublicQuote', { token });
      return response.data;
    },
    enabled: !!token
  });

  const createSignatureMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteSignature.create(data)
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Quote.update(id, data)
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteEvent.create(data)
  });

  useEffect(() => {
    if (quoteData?.quote) {
      setQuote(quoteData.quote);
      setQuoteItems(quoteData.quoteItems || []);
      
      createEventMutation.mutate({
        quote_id: quoteData.quote.id,
        event_type: "viewed",
        occurred_at: new Date().toISOString(),
        metadata: JSON.stringify({ ip: "client" })
      });

      if (quoteData.quote.status === "Sent") {
        updateQuoteMutation.mutate({
          id: quoteData.quote.id,
          data: { ...quoteData.quote, status: "Viewed" }
        });
      }
    }
  }, [quoteData]);

  useEffect(() => {
    if (quoteItems.length > 0) {
      const initialSelection = {};
      quoteItems.forEach(item => {
        initialSelection[item.id] = item.is_selected;
      });
      setSelectedItems(initialSelection);
    }
  }, [quoteItems]);

  const calculateTotals = () => {
    const items = quoteItems.filter(item => !item.is_optional || selectedItems[item.id]);
    const subtotal = items.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
    const tax = items.reduce((sum, item) => {
      const lineSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      return sum + (lineSubtotal * (item.tax_rate || 0.1));
    }, 0);
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleAccept = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const signature = canvas.toDataURL();
    
    await createSignatureMutation.mutateAsync({
      quote_id: quote.id,
      signer_name: signerName,
      signer_email: signerEmail,
      signed_at: new Date().toISOString(),
      signature_data: signature,
      accepted_terms: acceptedTerms
    });

    await updateQuoteMutation.mutateAsync({
      id: quote.id,
      data: { ...quote, status: "Accepted" }
    });

    await createEventMutation.mutateAsync({
      quote_id: quote.id,
      event_type: "accepted",
      occurred_at: new Date().toISOString(),
      metadata: JSON.stringify({ signer: signerName })
    });

    setSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FAE008]" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#111827] mb-2">Quote Not Found</h2>
            <p className="text-[#6B7280]">This quote link is invalid or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quote.status === "Expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#111827] mb-2">Quote Expired</h2>
            <p className="text-[#6B7280] mb-6">
              This quote expired on {quote.expiry_date}. Please contact us for an updated quote.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || quote.status === "Accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#111827] mb-2">Quote Accepted!</h2>
            <p className="text-[#6B7280]">
              Thank you for accepting this quote. We'll be in touch soon to confirm the next steps.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="bg-white border border-[#E5E7EB] shadow-sm mb-6">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[#111827] mb-2">{quote.title}</h1>
                <p className="text-[#6B7280]">Quote #{quote.quote_number}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-[#6B7280] mb-1">Issue Date</div>
                <div className="font-semibold text-[#111827]">{quote.issue_date}</div>
                {quote.expiry_date && (
                  <>
                    <div className="text-sm text-[#6B7280] mt-2 mb-1">Valid Until</div>
                    <div className="font-semibold text-[#111827]">{quote.expiry_date}</div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-[#E5E7EB] pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#6B7280] mb-2">Prepared For:</h3>
                  <div className="space-y-1">
                    <div className="font-semibold text-[#111827]">{quote.customer_name}</div>
                    {quote.customer_email && <div className="text-sm text-[#6B7280]">{quote.customer_email}</div>}
                    {quote.customer_phone && <div className="text-sm text-[#6B7280]">{quote.customer_phone}</div>}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#E5E7EB] shadow-sm mb-6">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-[#111827] mb-6">Quote Items</h2>
            <div className="space-y-4">
              {quoteItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border transition-all ${
                    item.is_optional && !selectedItems[item.id]
                      ? 'border-[#E5E7EB] bg-[#F9FAFB] opacity-60'
                      : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {quote.allow_item_selection && item.is_optional && (
                          <Switch
                            checked={selectedItems[item.id]}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                        )}
                        <div>
                          <h4 className="font-semibold text-[#111827]">{item.title}</h4>
                          {item.is_optional && (
                            <span className="text-xs text-[#6B7280]">(Optional)</span>
                          )}
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-sm text-[#6B7280] mb-2">{item.description}</p>
                      )}
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full max-w-xs h-32 object-cover rounded-lg mb-2"
                        />
                      )}
                      <div className="text-sm text-[#6B7280]">
                        {item.quantity} {item.unit_label} × ${item.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#111827]">
                        ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
              <div className="space-y-2 max-w-sm ml-auto">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal:</span>
                  <span className="font-medium">${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Tax (GST):</span>
                  <span className="font-medium">${totals.tax.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-[#111827] pt-2 border-t border-[#E5E7EB]">
                  <span>Total:</span>
                  <span>${totals.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {quote.terms_and_conditions && (
          <Card className="bg-white border border-[#E5E7EB] shadow-sm mb-6">
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold text-[#111827] mb-4">Terms & Conditions</h3>
              <p className="text-sm text-[#6B7280] whitespace-pre-wrap">{quote.terms_and_conditions}</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border border-[#E5E7EB] shadow-sm">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-[#111827] mb-6">Accept Quote</h2>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signer_name">Full Name *</Label>
                  <Input
                    id="signer_name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signer_email">Email *</Label>
                  <Input
                    id="signer_email"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Signature *</Label>
                <div className="border-2 border-[#E5E7EB] rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full h-32 bg-white cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                >
                  Clear Signature
                </Button>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={setAcceptedTerms}
                  id="accept_terms"
                />
                <Label htmlFor="accept_terms" className="text-sm text-[#6B7280] cursor-pointer">
                  I have read and accept the terms and conditions outlined in this quote
                </Label>
              </div>

              <Button
                onClick={handleAccept}
                disabled={!signerName || !signerEmail || !acceptedTerms || createSignatureMutation.isPending}
                className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold text-lg py-6"
              >
                {createSignatureMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Accept & Sign Quote'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}