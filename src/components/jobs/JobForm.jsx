
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import MeasurementsForm from "./MeasurementsForm";
import MultiTechnicianSelect from "./MultiTechnicianSelect";

export default function JobForm({ job, jobTypes, technicians, onSubmit, onCancel, isSubmitting, preselectedCustomerId }) {
  const [formData, setFormData] = useState(job || {
    job_number: null,
    customer_id: preselectedCustomerId || "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_type: "",
    address: "",
    product: "",
    job_type_id: "",
    job_type_name: "",
    assigned_to: [], // Changed to array
    assigned_to_name: [], // Changed to array
    scheduled_date: "",
    scheduled_time: "",
    status: "scheduled",
    outcome: "",
    notes: "",
    additional_info: "",
    measurements: null,
    image_urls: [],
    quote_url: "",
    invoice_url: "",
  });

  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingQuote, setUploadingQuote] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", email: "" });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }),
  });

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      handleCustomerChange(preselectedCustomerId);
    }
  }, [preselectedCustomerId, customers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!job) {
      const allJobs = await base44.entities.Job.list('-job_number', 1);
      const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
      formData.job_number = lastJobNumber + 1;
    }
    
    onSubmit(formData);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone: customer.phone || "",
        customer_email: customer.email || "",
        customer_type: customer.customer_type || "",
        address: customer.address || formData.address, // Added customer.address
      });
    }
  };

  const handleCreateNewCustomer = async () => {
    try {
      const newCustomer = await base44.entities.Customer.create(newCustomerData);
      setFormData({
        ...formData,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || "",
        customer_type: newCustomer.customer_type || "",
        address: newCustomer.address || "", // Added newCustomer.address
      });
      setShowNewCustomerDialog(false);
      setNewCustomerData({ name: "", phone: "", email: "" });
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  const handleJobTypeChange = (jobTypeId) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    setFormData({
      ...formData,
      job_type_id: jobTypeId,
      job_type_name: jobType?.name || ""
    });
  };

  const handleTechnicianChange = (techEmails) => { // Changed to accept array
    const techNames = techEmails.map(email => {
      const tech = technicians.find(t => t.email === email);
      return tech?.full_name || "";
    });
    setFormData({
      ...formData,
      assigned_to: techEmails,
      assigned_to_name: techNames
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newImageUrls = results.map(result => result.file_url);
      
      setFormData({
        ...formData,
        image_urls: [...(formData.image_urls || []), ...newImageUrls]
      });
    } catch (error) {
      console.error("Error uploading images:", error);
    }
    setUploadingImages(false);
  };

  const handleQuoteUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingQuote(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, quote_url: file_url });
    } catch (error) {
      console.error("Error uploading quote:", error);
    }
    setUploadingQuote(false);
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingInvoice(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, invoice_url: file_url });
    } catch (error) {
      console.error("Error uploading invoice:", error);
    }
    setUploadingInvoice(false);
  };

  const removeImage = (indexToRemove) => {
    setFormData({
      ...formData,
      image_urls: formData.image_urls.filter((_, index) => index !== indexToRemove)
    });
  };

  return (
    <>
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-2xl font-bold">
              {job ? `Edit Job #${job.job_number}` : 'Create New Job'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <div className="flex gap-2">
                <Select value={formData.customer_id} onValueChange={handleCustomerChange} required>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCustomerDialog(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Service Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Select value={formData.product} onValueChange={(val) => setFormData({ ...formData, product: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Garage Door">Garage Door</SelectItem>
                    <SelectItem value="Gate">Gate</SelectItem>
                    <SelectItem value="Roller Shutter">Roller Shutter</SelectItem>
                    <SelectItem value="Multiple">Multiple</SelectItem>
                    <SelectItem value="Custom Garage Door">Custom Garage Door</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_type">Job Type</Label>
                <Select value={formData.job_type_id} onValueChange={handleJobTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign Technicians</Label>
                <MultiTechnicianSelect
                  selectedEmails={formData.assigned_to}
                  technicians={technicians}
                  onChange={handleTechnicianChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Select value={formData.outcome} onValueChange={(val) => setFormData({ ...formData, outcome: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_quote">New Quote</SelectItem>
                    <SelectItem value="update_quote">Update Quote</SelectItem>
                    <SelectItem value="send_invoice">Send Invoice</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="return_visit_required">Return Visit Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Scheduled Date *</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_time">Scheduled Time</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes & Instructions</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Add any special instructions or notes..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional_info">Additional Info</Label>
              <Textarea
                id="additional_info"
                value={formData.additional_info}
                onChange={(e) => setFormData({ ...formData, additional_info: e.target.value })}
                rows={3}
                placeholder="Add any additional information..."
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Measurements</h3>
              <MeasurementsForm
                measurements={formData.measurements}
                onChange={(measurements) => setFormData({ ...formData, measurements })}
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900">File Uploads</h3>
              
              <div className="space-y-2">
                <Label>Images</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload').click()}
                    disabled={uploadingImages}
                  >
                    {uploadingImages ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                    ) : (
                      <><ImageIcon className="w-4 h-4 mr-2" />Upload Images</>
                    )}
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                {formData.image_urls && formData.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.image_urls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img src={url} alt={`Upload ${index + 1}`} className="w-full h-24 object-cover rounded border" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quote</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('quote-upload').click()}
                      disabled={uploadingQuote}
                    >
                      {uploadingQuote ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                      ) : (
                        <><FileText className="w-4 h-4 mr-2" />Upload Quote</>
                      )}
                    </Button>
                    <input
                      id="quote-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleQuoteUpload}
                    />
                  </div>
                  {formData.quote_url && (
                    <a href={formData.quote_url} target="_blank" rel="noopener noreferrer" 
                       className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      View Quote
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Invoice</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('invoice-upload').click()}
                      disabled={uploadingInvoice}
                    >
                      {uploadingInvoice ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                      ) : (
                        <><FileText className="w-4 h-4 mr-2" />Upload Invoice</>
                      )}
                    </Button>
                    <input
                      id="invoice-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleInvoiceUpload}
                    />
                  </div>
                  {formData.invoice_url && (
                    <a href={formData.invoice_url} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      View Invoice
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900">
              {isSubmitting ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_customer_name">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_phone">Phone</Label>
              <Input
                id="new_customer_phone"
                type="tel"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_email">Email</Label>
              <Input
                id="new_customer_email"
                type="email"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewCustomer}
              disabled={!newCustomerData.name}
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900"
            >
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
