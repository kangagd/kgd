import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function QuoteForm({ quote, onSubmit, onCancel, isSubmitting, projects, customers }) {
  const [formData, setFormData] = useState(quote || {
    quote_number: "",
    title: "",
    project_id: "",
    project_title: "",
    job_id: "",
    job_number: null,
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    organisation_id: "",
    organisation_name: "",
    status: "Draft",
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: "",
    currency: "AUD",
    subtotal: 0,
    tax_total: 0,
    discount_total: 0,
    total: 0,
    allow_item_selection: false,
    terms_and_conditions: "",
    internal_notes: "",
    public_share_token: Math.random().toString(36).substring(2, 15),
  });

  useEffect(() => {
    if (!formData.quote_number && !quote) {
      // Generate quote number
      setFormData(prev => ({
        ...prev,
        quote_number: `Q-${Date.now().toString().slice(-6)}`
      }));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.name,
        customer_email: customer.email || "",
        customer_phone: customer.phone || "",
      });
    }
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData({
        ...formData,
        project_id: projectId,
        project_title: project.title,
        customer_id: project.customer_id,
        customer_name: project.customer_name,
        customer_email: project.customer_email || "",
        customer_phone: project.customer_phone || "",
      });
    }
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
      <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onCancel}
            className="hover:bg-[#F3F4F6]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <CardTitle className="text-xl font-semibold text-[#111827]">
            {quote ? 'Edit Quote' : 'Create New Quote'}
          </CardTitle>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="quote_number">Quote Number *</Label>
              <Input
                id="quote_number"
                value={formData.quote_number}
                onChange={(e) => setFormData({ ...formData, quote_number: e.target.value })}
                required
                placeholder="Q-000123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date *</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Quote Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Garage Door Installation Quote"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="project_id">Project (Optional)</Label>
              <Select value={formData.project_id} onValueChange={handleProjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {projects.filter(p => !p.deleted_at).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select value={formData.customer_id} onValueChange={handleCustomerChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter(c => !c.deleted_at && c.status === 'active').map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Viewed">Viewed</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="Declined">Declined</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
            <Textarea
              id="terms_and_conditions"
              value={formData.terms_and_conditions}
              onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
              placeholder="Enter terms and conditions..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_notes">Internal Notes</Label>
            <Textarea
              id="internal_notes"
              value={formData.internal_notes}
              onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
              placeholder="Add internal notes (not visible to customer)..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-[#E5E7EB] flex justify-end gap-3 p-6 bg-[#F9FAFB]">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
          >
            {isSubmitting ? 'Saving...' : quote ? 'Update Quote' : 'Create Quote'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}