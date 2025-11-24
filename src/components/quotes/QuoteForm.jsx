import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function QuoteForm({ quote, onSubmit, onCancel, isSubmitting, projects, customers, jobs = [] }) {
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
    terms_and_conditions: `1. These terms and conditions apply to any work performed and materials supplied by KangarooGD Pty Ltd and shall govern the contract unless expressly modified in writing. "We," "us," "the contractor," and "our" represent KangarooGD Pty Ltd, "you," "the client," "the customer," and "your" represent the person who requested services and enters into this contract.

2. Full Terms available at www.kangaroogd.com.au/terms-and-conditions

3. Quotes are valid for 30 days from the date of issue.

4. Acceptance is confirmed upon receipt of deposit, signed approval, or written confirmation.

5. Payment terms for Installations:
   - Upon acceptance, an invoice will be issued per the following structure:
   - 50% payment is due upon receipt of the initial invoice to cover material costs.
   - 30% payment is due at least 2 days prior to job commencement to cover initial labour.
   - The remaining balance is due on site on completion – payment can be made via bank transfer, credit card (additional charges apply) or PayTo.

6. Payment terms for Other Works:
   - 50% payment is required on acceptance of quote. Balance is due on site on completion - payment can be made via bank transfer, credit card (additional charges apply) or PayTo.

7. Initial payments are non-refundable once materials have been ordered.

8. Cancellations before materials are ordered are subject to a cancellation fee.

9. Initial Payments are non-refundable once materials are ordered.

10. Additional charges may apply for call-outs, cancellations, after-hours work, or re-attendance.

11. After hours Call Out Fee applies:
    - Saturday and weekday after-hours works incur a call-out fee of $199+GST.
    - Sunday and Public Holiday works incur a call-out fee of $249+GST.

12. Warranty-Related Visits:
    - Business hours will not incur a call out fee if warranty is valid.
    - Standard call-out fees apply for after hours visits (See 11.1).

13. All prices are exclusive of GST unless otherwise specified.

14. The client must ensure site readiness, accessibility, and structural suitability. Delays or obstructions may incur additional costs.

15. A standard 24-month warranty applies unless otherwise stated, excluding oil canning, general wear, misuse, corrosion, or environmental factors.

16. KangarooGD accepts no liability for indirect, consequential, or delay-related losses beyond its control.

17. Ownership of goods remains with KangarooGD until full payment is received.

18. Completion is deemed to occur upon final payment in full.

19. For full Terms & Conditions, please visit: www.kangaroogd.com.au/terms-and-conditions`,
    internal_notes: "",
    public_share_token: Math.random().toString(36).substring(2, 15),
  });

  useEffect(() => {
    if (!formData.quote_number && !quote) {
      if (formData.job_id && jobs.length > 0) {
        const linkedJob = jobs.find(job => job.id === formData.job_id);
        if (linkedJob?.job_number) {
          setFormData(prev => ({
            ...prev,
            quote_number: `Q-${linkedJob.job_number}`
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            quote_number: `Q-${Date.now().toString().slice(-6)}`
          }));
        }
      } else {
        setFormData(prev => ({
          ...prev,
          quote_number: `Q-${Date.now().toString().slice(-6)}`
        }));
      }
    }
  }, [formData.job_id, jobs]);

  useEffect(() => {
    if (formData.issue_date && !quote) {
      const issueDate = new Date(formData.issue_date);
      const expiryDate = new Date(issueDate);
      expiryDate.setDate(expiryDate.getDate() + 30);
      setFormData(prev => ({
        ...prev,
        expiry_date: expiryDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.issue_date]);

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
      // Find the most recent job for this project
      const projectJobs = jobs.filter(job => job.project_id === projectId);
      const latestJob = projectJobs.sort((a, b) => b.job_number - a.job_number)[0];
      
      setFormData({
        ...formData,
        project_id: projectId,
        project_title: project.title,
        customer_id: project.customer_id,
        customer_name: project.customer_name,
        customer_email: project.customer_email || "",
        customer_phone: project.customer_phone || "",
        job_id: latestJob?.id || "",
        job_number: latestJob?.job_number || null,
        quote_number: latestJob?.job_number ? `Q-${latestJob.job_number}` : formData.quote_number
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