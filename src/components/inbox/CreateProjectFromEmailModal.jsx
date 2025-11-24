import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Check, AlertCircle, RefreshCw, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import AddressAutocomplete from "../common/AddressAutocomplete";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    address_full: ""
  });

  const [formData, setFormData] = useState({
    title: thread?.subject || "",
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    project_type: "Garage Door Install",
    status: "Lead",
    description: "",
    notes: "",
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    ai_source_email_thread_id: thread?.id
  });

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const activeCustomers = customers.filter(c => !c.deleted_at && c.status !== 'inactive');

  // Auto-extract on open
  useEffect(() => {
    if (open && thread?.id && !aiSuggestions) {
      extractFromEmail();
    }
  }, [open, thread?.id]);

  const extractFromEmail = async () => {
    if (!thread?.id) return;
    
    setIsExtracting(true);
    try {
      const result = await base44.functions.invoke('extractProjectFromEmail', {
        threadId: thread.id
      });

      if (result.data?.suggestions) {
        setAiSuggestions(result.data.suggestions);
        
        // Auto-fill empty fields
        const suggestions = result.data.suggestions;
        
        // Try to match customer by email
        const matchedCustomer = activeCustomers.find(c => 
          c.email?.toLowerCase() === suggestions.customer_email?.toLowerCase()
        );

        setFormData(prev => ({
          ...prev,
          title: prev.title || thread?.subject || "",
          description: prev.description || suggestions.project_description || "",
          notes: prev.notes || suggestions.summary || "",
          project_type: suggestions.project_type || prev.project_type,
          status: suggestions.suggested_stage || prev.status,
          customer_id: matchedCustomer?.id || prev.customer_id,
          customer_name: matchedCustomer?.name || suggestions.customer_name || "",
          customer_phone: matchedCustomer?.phone || suggestions.customer_phone || "",
          customer_email: matchedCustomer?.email || suggestions.customer_email || "",
          address_full: prev.address_full || suggestions.site_address || ""
        }));

        // Pre-fill new customer form with AI suggestions
        if (!matchedCustomer && suggestions.customer_name) {
          setNewCustomerData({
            name: suggestions.customer_name || "",
            phone: suggestions.customer_phone || "",
            email: suggestions.customer_email || "",
            address_full: suggestions.site_address || ""
          });
        }
      }
    } catch (error) {
      console.error('Error extracting from email:', error);
      toast.error('Failed to extract project details');
    } finally {
      setIsExtracting(false);
    }
  };

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create({ ...data, status: 'active' }),
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormData(prev => ({
        ...prev,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || "",
        address_full: newCustomer.address_full || prev.address_full
      }));
      setShowNewCustomerForm(false);
      toast.success('Customer created');
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: (newProject) => {
      onSuccess(newProject.id, newProject.title);
    }
  });

  const handleCustomerChange = (customerId) => {
    const customer = activeCustomers.find(c => c.id === customerId);
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
      customer_email: customer?.email || "",
      address_full: customer?.address_full || prev.address_full,
      address_street: customer?.address_street || prev.address_street,
      address_suburb: customer?.address_suburb || prev.address_suburb,
      address_state: customer?.address_state || prev.address_state,
      address_postcode: customer?.address_postcode || prev.address_postcode
    }));
  };

  const applyAiSuggestion = (field, value) => {
    if (!value) return;
    
    if (field === 'customer') {
      // Try to find matching customer
      const matched = activeCustomers.find(c => 
        c.email?.toLowerCase() === aiSuggestions.customer_email?.toLowerCase() ||
        c.name?.toLowerCase() === aiSuggestions.customer_name?.toLowerCase()
      );
      if (matched) {
        handleCustomerChange(matched.id);
      } else {
        // Pre-fill new customer form
        setNewCustomerData({
          name: aiSuggestions.customer_name || "",
          phone: aiSuggestions.customer_phone || "",
          email: aiSuggestions.customer_email || "",
          address_full: aiSuggestions.site_address || ""
        });
        setShowNewCustomerForm(true);
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    toast.success('Applied AI suggestion');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      toast.error('Please select or create a customer');
      return;
    }
    
    const projectData = {
      ...formData,
      ai_email_summary: aiSuggestions?.summary,
      ai_key_requirements: aiSuggestions ? JSON.stringify(aiSuggestions) : null,
      ai_suggested_project_type: aiSuggestions?.project_type,
      ai_suggested_stage: aiSuggestions?.suggested_stage,
      ai_last_updated_at: new Date().toISOString()
    };
    createProjectMutation.mutate(projectData);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Normal': return 'bg-blue-100 text-blue-800';
      case 'Low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create Project from Email
            {isExtracting && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
          </DialogTitle>
        </DialogHeader>

        {/* AI Suggestions Panel */}
        {aiSuggestions && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-[14px] font-medium text-purple-800">AI Suggestions</span>
                {aiSuggestions.confidence_score && (
                  <Badge variant="secondary" className="text-[11px]">
                    {Math.round(aiSuggestions.confidence_score * 100)}% confidence
                  </Badge>
                )}
                {aiSuggestions.priority && aiSuggestions.priority !== 'Normal' && (
                  <Badge className={getPriorityColor(aiSuggestions.priority)}>
                    {aiSuggestions.priority}
                  </Badge>
                )}
              </div>
              {showAiPanel ? <ChevronUp className="w-4 h-4 text-purple-600" /> : <ChevronDown className="w-4 h-4 text-purple-600" />}
            </button>

            {showAiPanel && (
              <div className="mt-2 p-4 bg-purple-50/50 rounded-lg border border-purple-100 space-y-3">
                <div className="flex justify-between items-start">
                  <p className="text-[13px] text-purple-800 leading-relaxed flex-1">
                    {aiSuggestions.summary}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={extractFromEmail}
                    disabled={isExtracting}
                    className="ml-2 h-7"
                  >
                    <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {aiSuggestions.requested_timeframe && (
                  <div className="flex items-center gap-2 text-[12px] text-purple-700">
                    <AlertCircle className="w-3 h-3" />
                    Timeframe mentioned: {aiSuggestions.requested_timeframe}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-200">
                  {aiSuggestions.customer_name && (
                    <button
                      type="button"
                      onClick={() => applyAiSuggestion('customer', aiSuggestions.customer_name)}
                      className="flex items-center gap-2 p-2 text-left bg-white rounded border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-[12px]"
                    >
                      <Check className="w-3 h-3 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-purple-500 uppercase">Customer</div>
                        <div className="truncate text-purple-800">{aiSuggestions.customer_name}</div>
                      </div>
                    </button>
                  )}
                  {aiSuggestions.project_type && (
                    <button
                      type="button"
                      onClick={() => applyAiSuggestion('project_type', aiSuggestions.project_type)}
                      className="flex items-center gap-2 p-2 text-left bg-white rounded border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-[12px]"
                    >
                      <Check className="w-3 h-3 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-purple-500 uppercase">Type</div>
                        <div className="truncate text-purple-800">{aiSuggestions.project_type}</div>
                      </div>
                    </button>
                  )}
                  {aiSuggestions.site_address && (
                    <button
                      type="button"
                      onClick={() => applyAiSuggestion('address_full', aiSuggestions.site_address)}
                      className="flex items-center gap-2 p-2 text-left bg-white rounded border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-[12px] col-span-2"
                    >
                      <Check className="w-3 h-3 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-purple-500 uppercase">Address</div>
                        <div className="truncate text-purple-800">{aiSuggestions.site_address}</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isExtracting && !aiSuggestions && (
          <div className="flex items-center justify-center p-8 bg-purple-50 rounded-lg border border-purple-200 mb-4">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-[14px] text-purple-800">Analyzing email thread...</p>
              <p className="text-[12px] text-purple-600">Extracting project details with AI</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Garage Door Repair - Smith Residence"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Customer *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                className="h-7 text-[12px]"
              >
                <Plus className="w-3 h-3 mr-1" />
                New Customer
              </Button>
            </div>
            
            {showNewCustomerForm ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[12px]">Name *</Label>
                    <Input
                      value={newCustomerData.name}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                      placeholder="Customer name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Phone</Label>
                    <Input
                      value={newCustomerData.phone}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                      placeholder="Phone number"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Email</Label>
                  <Input
                    value={newCustomerData.email}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                    placeholder="Email address"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Address</Label>
                  <Input
                    value={newCustomerData.address_full}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, address_full: e.target.value })}
                    placeholder="Customer address"
                    className="h-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => createCustomerMutation.mutate(newCustomerData)}
                    disabled={!newCustomerData.name || createCustomerMutation.isPending}
                    className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                  >
                    {createCustomerMutation.isPending ? 'Creating...' : 'Create & Select'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCustomerForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select
                value={formData.customer_id}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {activeCustomers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.email && `• ${customer.email}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select
                value={formData.project_type}
                onValueChange={(value) => setFormData({ ...formData, project_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Garage Door Install">Garage Door Install</SelectItem>
                  <SelectItem value="Gate Install">Gate Install</SelectItem>
                  <SelectItem value="Roller Shutter Install">Roller Shutter Install</SelectItem>
                  <SelectItem value="Multiple">Multiple</SelectItem>
                  <SelectItem value="Motor/Accessory">Motor/Accessory</SelectItem>
                  <SelectItem value="Repair">Repair</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
                  <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                  <SelectItem value="Quote Approved">Quote Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Site Address</Label>
            <AddressAutocomplete
              value={formData.address_full || ""}
              onChange={(addressData) => setFormData({ ...formData, ...addressData })}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Project scope and requirements..."
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              disabled={createProjectMutation.isPending || !formData.customer_id}
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}