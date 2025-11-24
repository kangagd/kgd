import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, Loader2, DollarSign, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AIQuoteGenerator({ project, onQuoteGenerated, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [projectDetails, setProjectDetails] = useState({
    description: project.description || "",
    projectType: project.project_type || "",
    customerNotes: ""
  });

  const generateQuote = async () => {
    setIsGenerating(true);
    try {
      // Fetch historical data for context
      const [priceList, recentProjects] = await Promise.all([
        base44.entities.PriceListItem.list(),
        base44.entities.Project.filter({ project_type: projectDetails.projectType })
      ]);

      const completedProjects = recentProjects
        .filter(p => p.status === 'Completed' && p.quote_value)
        .slice(0, 10);

      const prompt = `You are an expert quote generator for garage door, gate, and roller shutter installations.

**Project Details:**
- Type: ${projectDetails.projectType}
- Description: ${projectDetails.description}
- Customer Notes: ${projectDetails.customerNotes}
${project.doors && project.doors.length > 0 ? `- Doors: ${JSON.stringify(project.doors)}` : ''}

**Available Products/Services from Price List:**
${priceList.map(item => `- ${item.item}: $${item.price} (${item.category})`).join('\n')}

**Historical Project Data (for pricing reference):**
${completedProjects.map(p => `Project: ${p.title}, Type: ${p.project_type}, Quote: $${p.quote_value}`).join('\n')}

**Task:**
Generate a detailed quote with line items, descriptions, and pricing. Include:
1. Main installation items with realistic pricing based on the price list
2. Recommended add-ons or additional services that would benefit this project
3. Brief description for each line item explaining what it includes

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "lineItems": [
    {
      "item": "Item name",
      "description": "What this includes",
      "quantity": 1,
      "unitPrice": 1200,
      "total": 1200,
      "category": "Main" or "Add-on"
    }
  ],
  "totalValue": 5000,
  "notes": "Brief summary of the quote and any special considerations",
  "recommendations": "Suggested add-ons or upgrades that would enhance the project"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unitPrice: { type: "number" },
                  total: { type: "number" },
                  category: { type: "string" }
                }
              }
            },
            totalValue: { type: "number" },
            notes: { type: "string" },
            recommendations: { type: "string" }
          }
        }
      });

      setGeneratedQuote(response);
      toast.success('Quote generated successfully!');
    } catch (error) {
      console.error('Error generating quote:', error);
      toast.error('Failed to generate quote. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateLineItem = (index, field, value) => {
    const updated = { ...generatedQuote };
    updated.lineItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unitPrice') {
      updated.lineItems[index].total = 
        updated.lineItems[index].quantity * updated.lineItems[index].unitPrice;
    }
    
    updated.totalValue = updated.lineItems.reduce((sum, item) => sum + item.total, 0);
    setGeneratedQuote(updated);
  };

  const removeLineItem = (index) => {
    const updated = { ...generatedQuote };
    updated.lineItems.splice(index, 1);
    updated.totalValue = updated.lineItems.reduce((sum, item) => sum + item.total, 0);
    setGeneratedQuote(updated);
  };

  const addLineItem = () => {
    const updated = { ...generatedQuote };
    updated.lineItems.push({
      item: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      category: "Main"
    });
    setGeneratedQuote(updated);
  };

  const applyQuote = () => {
    const quoteProducts = generatedQuote.lineItems
      .map(item => `<p><strong>${item.item}</strong> (x${item.quantity}): $${item.total.toFixed(2)}<br>${item.description}</p>`)
      .join('\n');

    onQuoteGenerated({
      quote_value: generatedQuote.totalValue,
      quote_products: quoteProducts,
      quote_notes: `${generatedQuote.notes}\n\n<strong>Recommendations:</strong>\n${generatedQuote.recommendations}`
    });
    
    toast.success('Quote applied to project');
    onClose();
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-lg">
      <CardHeader className="bg-gradient-to-r from-[#FAE008]/10 to-white px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FAE008]" />
            <CardTitle className="text-[16px] font-semibold text-[#111827]">
              AI Quote Generator
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {!generatedQuote ? (
          <>
            <div>
              <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                Project Type
              </label>
              <Input
                value={projectDetails.projectType}
                onChange={(e) => setProjectDetails({ ...projectDetails, projectType: e.target.value })}
                placeholder="e.g., Garage Door Install"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                Project Description
              </label>
              <Textarea
                value={projectDetails.description}
                onChange={(e) => setProjectDetails({ ...projectDetails, description: e.target.value })}
                placeholder="Describe the project requirements..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#4B5563] mb-1.5 block">
                Customer Notes (Optional)
              </label>
              <Textarea
                value={projectDetails.customerNotes}
                onChange={(e) => setProjectDetails({ ...projectDetails, customerNotes: e.target.value })}
                placeholder="Any special requests or considerations..."
                className="min-h-[80px]"
              />
            </div>

            <Button
              onClick={generateQuote}
              disabled={isGenerating || !projectDetails.projectType}
              className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Quote...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Quote with AI
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold text-[#111827]">Generated Quote</h3>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#FAE008] text-[#111827] font-bold text-[14px] px-3 py-1">
                  Total: ${generatedQuote.totalValue.toFixed(2)}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {generatedQuote.lineItems.map((item, index) => (
                <Card key={index} className="border border-[#E5E7EB]">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={item.category === "Add-on" ? "outline" : "default"}>
                        {item.category}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <Input
                      value={item.item}
                      onChange={(e) => updateLineItem(index, 'item', e.target.value)}
                      placeholder="Item name"
                      className="font-medium"
                    />
                    
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="text-[13px] min-h-[60px]"
                    />
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-[#6B7280] mb-1 block">Qty</label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7280] mb-1 block">Unit Price</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="pl-6"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6B7280] mb-1 block">Total</label>
                        <div className="h-10 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 flex items-center font-semibold text-[#111827]">
                          ${item.total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              onClick={addLineItem}
              variant="outline"
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Line Item
            </Button>

            {generatedQuote.notes && (
              <Card className="border border-[#E5E7EB] bg-[#F9FAFB]">
                <CardContent className="p-3">
                  <h4 className="text-[13px] font-semibold text-[#111827] mb-2">Notes</h4>
                  <p className="text-[13px] text-[#4B5563]">{generatedQuote.notes}</p>
                </CardContent>
              </Card>
            )}

            {generatedQuote.recommendations && (
              <Card className="border border-[#FAE008]/30 bg-[#FAE008]/5">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#FAE008] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[13px] font-semibold text-[#111827] mb-1">AI Recommendations</h4>
                      <p className="text-[13px] text-[#4B5563]">{generatedQuote.recommendations}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                onClick={applyQuote}
                className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
              >
                Apply Quote to Project
              </Button>
              <Button
                onClick={() => setGeneratedQuote(null)}
                variant="outline"
              >
                Start Over
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}