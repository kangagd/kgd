import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function JobForm({ job, jobTypes, technicians, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(job || {
    job_number: null,
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address: "",
    job_type_id: "",
    job_type_name: "",
    assigned_to: "",
    assigned_to_name: "",
    scheduled_date: "",
    scheduled_time: "",
    status: "scheduled",
    priority: "medium",
    notes: "",
    additional_info: "",
    image_urls: [],
    quote_url: "",
    invoice_url: "",
  });

  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingQuote, setUploadingQuote] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Generate job number if creating new job
    if (!job) {
      const { data: allJobs } = await base44.entities.Job.list('-job_number', 1);
      const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
      formData.job_number = lastJobNumber + 1;
    }
    
    onSubmit(formData);
  };

  const handleJobTypeChange = (jobTypeId) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    setFormData({
      ...formData,
      job_type_id: jobTypeId,
      job_type_name: jobType?.name || ""
    });
  };

  const handleTechnicianChange = (techEmail) => {
    const tech = technicians.find(t => t.email === techEmail);
    setFormData({
      ...formData,
      assigned_to: techEmail,
      assigned_to_name: tech?.full_name || ""
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
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_email">Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
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
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={handleTechnicianChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.email}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
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
          <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
            {isSubmitting ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}