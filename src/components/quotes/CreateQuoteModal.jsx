import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FileText } from "lucide-react";

export default function CreateQuoteModal({ 
  isOpen, 
  onClose, 
  project = null, 
  job = null,
  customer = null,
  onQuoteCreated 
}) {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [quoteName, setQuoteName] = useState('');
  const [validDays, setValidDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([{ name: '', description: '', quantity: 1, price: 0 }]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      // Set default quote name
      const defaultName = project?.title 
        ? `${project.title} – ${customer?.name || project.customer_name || 'Customer'}`
        : job?.job_number 
          ? `Job #${job.job_number} – ${customer?.name || job.customer_name || 'Customer'}`
          : '';
      setQuoteName(defaultName);
    }
  }, [isOpen, project, job, customer]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await base44.functions.invoke('getPandaDocTemplates');
      if (response.data?.templates) {
        setTemplates(response.data.templates);
        if (response.data.templates.length > 0) {
          setSelectedTemplate(response.data.templates[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load PandaDoc templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { name: '', description: '', quantity: 1, price: 0 }]);
  };

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setIsCreating(true);
    try {
      const response = await base44.functions.invoke('createPandaDocQuoteFromProjectOrJob', {
        projectId: project?.id || null,
        jobId: job?.id || null,
        templateId: selectedTemplate,
        quoteName: quoteName || undefined,
        validDays,
        lineItems: lineItems.filter(item => item.name),
        notes
      });

      if (response.data?.success) {
        toast.success('Quote created in PandaDoc');
        onQuoteCreated?.(response.data.quote);
        onClose();
        // Reset form
        setLineItems([{ name: '', description: '', quantity: 1, price: 0 }]);
        setNotes('');
      } else {
        toast.error(response.data?.error || 'Failed to create quote');
      }
    } catch (error) {
      console.error('Create quote error:', error);
      toast.error('Failed to create quote');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FAE008]" />
            Create PandaDoc Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>PandaDoc Template *</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-[#6B7280]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-[14px] text-[#6B7280]">
                No templates found. Create a template in PandaDoc first.
              </p>
            ) : (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quote Name */}
          <div className="space-y-2">
            <Label>Quote Name</Label>
            <Input
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="e.g. Garage Door Install – Smith"
            />
          </div>

          {/* Valid Days */}
          <div className="space-y-2">
            <Label>Valid For (days)</Label>
            <Input
              type="number"
              value={validDays}
              onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
              min={1}
              max={365}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items (Optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
            <p className="text-[12px] text-[#6B7280]">
              These will populate the pricing table in your PandaDoc template.
            </p>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-[#F9FAFB] rounded-lg">
                  <div className="col-span-4">
                    <Input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateLineItem(index, 'price', parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="col-span-1">
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lineItems.some(item => item.name) && (
              <div className="text-right text-[14px] font-medium text-[#111827]">
                Total: ${calculateTotal().toFixed(2)} AUD
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for internal reference only..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isCreating || !selectedTemplate}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Quote'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}