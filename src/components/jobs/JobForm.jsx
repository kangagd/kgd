
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import MultiTechnicianSelect from "./MultiTechnicianSelect";
import RichTextEditor from "../common/RichTextEditor";
import { shouldAutoSchedule } from "./jobStatusHelper";
import { toast } from "sonner";

const JOB_TYPE_DURATIONS = {
  "Initial Site Visit": 2,
  "Final Measure": 2,
  "Installation": 3,
  "On site Repair": 2,
  "Investigation": 1,
  "Maintenance": 1,
  "Call Back": 1,
  "Emergency Repair": 1
};

export default function JobForm({ job, technicians, onSubmit, onCancel, isSubmitting, preselectedCustomerId, preselectedProjectId }) {
  const [formData, setFormData] = useState(job || {
    job_number: null,
    project_id: preselectedProjectId || "",
    project_name: "",
    customer_id: preselectedCustomerId || "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_type: "",
    address: "",
    product: "",
    job_type: "",
    assigned_to: [],
    assigned_to_name: [],
    scheduled_date: "",
    scheduled_time: "",
    expected_duration: null,
    status: "open",
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
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", email: "" });
  const [potentialDuplicates, setPotentialDuplicates] = useState([]);
  const [liveDuplicates, setLiveDuplicates] = useState([]);

  const queryClient = useQueryClient();

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customers = allCustomers.filter(c => c.status === 'active' && !c.deleted_at);

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const projects = allProjects.filter(p => !p.deleted_at);

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      handleCustomerChange(preselectedCustomerId);
    }
  }, [preselectedCustomerId, customers]);

  useEffect(() => {
    if (preselectedProjectId && projects.length > 0) {
      handleProjectChange(preselectedProjectId);
    }
  }, [preselectedProjectId, projects]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer_id) {
      alert("Please select a customer");
      return;
    }

    if (!formData.scheduled_date) {
      alert("Please select a scheduled date");
      return;
    }
    
    let currentJobNumber = formData.job_number;
    if (!job) {
      const allJobs = await base44.entities.Job.list('-job_number', 1);
      const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
      currentJobNumber = lastJobNumber + 1;
    }
    
    // Auto-determine status
    let status = formData.status || 'open';
    if (shouldAutoSchedule(formData.scheduled_date, formData.scheduled_time)) {
      status = 'scheduled';
    }

    let jobData = {
      ...formData,
      job_number: currentJobNumber,
      status: status,
      assigned_to: formData.assigned_to || [],
      assigned_to_name: formData.assigned_to
        ? formData.assigned_to.map((email) => {
            const tech = technicians.find((t) => t.email === email);
            return tech?.full_name;
          }).filter(Boolean)
        : [],
    };

    if (formData.project_id) {
      const project = projects.find(p => p.id === formData.project_id);
      if (project) {
        jobData.project_name = project.title;
      } else {
        jobData.project_name = ""; // Clear if project not found
      }
    } else {
        jobData.project_name = ""; // Clear if no project_id
    }

    const customer = customers.find(c => c.id === formData.customer_id);
    if (customer) {
      jobData.customer_name = customer.name;
      jobData.customer_phone = customer.phone || "";
      jobData.customer_email = customer.email || "";
      jobData.customer_type = customer.customer_type || "";
    } else {
        jobData.customer_name = "";
        jobData.customer_phone = "";
        jobData.customer_email = "";
        jobData.customer_type = "";
    }

    // The original formData.job_type is already a string (e.g., "Installation")
    // If the intention was to use an ID and map to a name, a jobTypes list would be needed.
    // Based on existing code, formData.job_type already holds the display name.
    jobData.job_type_name = formData.job_type;
    
    // Remove empty fields, preserving original behavior
    if (!jobData.job_type) delete jobData.job_type;
    if (!jobData.product) delete jobData.product;
    if (!jobData.outcome) delete jobData.outcome;
    if (!jobData.project_id) delete jobData.project_id; // Don't send empty project_id if not selected

    if (status === 'scheduled' && !job) {
      toast.success(`Job will be created with status: Scheduled`);
    }

    onSubmit(jobData);
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
        address: customer.address || formData.address,
      });
    }
  };

  const handleProjectChange = (projectId) => {
    if (!projectId || projectId === 'null') {
      setFormData({
        ...formData,
        project_id: "",
        project_name: "",
        // When un-assigning project, customer details should remain what they were, or be cleared if no customer selected
      });
    } else {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setFormData({
          ...formData,
          project_id: projectId,
          project_name: project.title,
          customer_id: project.customer_id,
          customer_name: project.customer_name,
          customer_phone: project.customer_phone || "",
          customer_email: project.customer_email || "",
          address: project.address || formData.address
        });
      }
    }
  };

  const handleJobTypeChange = (jobType) => {
    const duration = JOB_TYPE_DURATIONS[jobType];
    setFormData({
      ...formData,
      job_type: jobType,
      expected_duration: duration || formData.expected_duration
    });
  };

  const checkForDuplicatesLive = (name) => {
    if (!name || name.length < 2) {
      setLiveDuplicates([]);
      return;
    }
    
    const duplicates = customers.filter(customer => {
      const nameLower = customer.name.toLowerCase();
      const newNameLower = name.toLowerCase();
      return nameLower.includes(newNameLower) || newNameLower.includes(nameLower);
    }).slice(0, 5);
    
    setLiveDuplicates(duplicates);
  };

  const checkForDuplicates = async () => {
    if (!newCustomerData.name) return;
    
    const duplicates = customers.filter(customer => {
      const nameLower = customer.name.toLowerCase();
      const newNameLower = newCustomerData.name.toLowerCase();
      const nameMatch = nameLower === newNameLower || 
                       nameLower.includes(newNameLower) || 
                       newNameLower.includes(nameLower);
      
      const phoneMatch = newCustomerData.phone && customer.phone && 
                        customer.phone.replace(/\D/g, '') === newCustomerData.phone.replace(/\D/g, '');
      
      const emailMatch = newCustomerData.email && customer.email && 
                        customer.email.toLowerCase() === newCustomerData.email.toLowerCase();
      
      return nameMatch || phoneMatch || emailMatch;
    });
    
    if (duplicates.length > 0) {
      setPotentialDuplicates(duplicates);
      setShowNewCustomerDialog(false);
      setShowDuplicateDialog(true);
    } else {
      await createNewCustomer();
    }
  };

  const createNewCustomer = async () => {
    try {
      const newCustomer = await base44.entities.Customer.create(newCustomerData);
      await queryClient.refetchQueries({ queryKey: ['customers'] });
      setFormData({
        ...formData,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || "",
        customer_type: newCustomer.customer_type || "",
        address: newCustomer.address || "",
      });
      setShowNewCustomerDialog(false);
      setShowDuplicateDialog(false);
      setNewCustomerData({ name: "", phone: "", email: "" });
      setPotentialDuplicates([]);
      setLiveDuplicates([]);
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Error creating customer. Please try again.");
    }
  };

  const handleCreateNewCustomer = async () => {
    await checkForDuplicates();
  };

  const handleUseExistingCustomer = (customer) => {
    handleCustomerChange(customer.id);
    setShowDuplicateDialog(false);
    setShowNewCustomerDialog(false);
    setNewCustomerData({ name: "", phone: "", email: "" });
    setPotentialDuplicates([]);
    setLiveDuplicates([]);
  };

  const handleForceCreateNew = async () => {
    await createNewCustomer();
  };

  const handleNewCustomerNameChange = (value) => {
    setNewCustomerData({ ...newCustomerData, name: value });
    checkForDuplicatesLive(value);
  };

  const handleTechnicianChange = (techEmails) => {
    const emailsArray = Array.isArray(techEmails) ? techEmails : [];
    const techNames = emailsArray.map(email => {
      const tech = technicians.find(t => t.email === email);
      return tech?.full_name || "";
    }).filter(Boolean);
    setFormData({
      ...formData,
      assigned_to: emailsArray,
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
      toast.error("Failed to upload images. Please try again.");
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
      toast.error("Failed to upload quote. Please try again.");
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
      toast.error("Failed to upload invoice. Please try again.");
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
      <div className="p-4 space-y-3">
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onCancel}
                className="hover:bg-slate-100 h-9 w-9 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-slate-900">
                {job ? `Edit Job #${job.job_number}` : formData.project_name ? `New Job - ${formData.project_name}` : 'Create New Job'}
              </h1>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Basic Information</span>
              
              {!preselectedProjectId && (
                <div className="space-y-1">
                  <Label htmlFor="project_id" className="text-sm font-medium text-slate-700">Project (Optional)</Label>
                  <Select 
                    value={formData.project_id || 'null'} 
                    onValueChange={handleProjectChange}
                  >
                    <SelectTrigger className="border-slate-300 h-10">
                      <SelectValue placeholder="Standalone job or select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">No Project (Standalone)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="customer_id" className="text-sm font-medium text-slate-700">Customer *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.customer_id} 
                    onValueChange={handleCustomerChange} 
                    required
                    disabled={!!formData.project_id}
                  >
                    <SelectTrigger className="flex-1 border-slate-300 h-10">
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
                  {!formData.project_id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewCustomerDialog(true)}
                      className="border-slate-300 hover:bg-slate-50 h-10 w-10 p-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.project_id && (
                  <p className="text-xs text-slate-500 mt-1">Customer from project</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700">Service Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="border-slate-300 h-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Job Details</span>
              
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="product" className="text-sm font-medium text-slate-700">Product</Label>
                  <Select value={formData.product} onValueChange={(val) => setFormData({ ...formData, product: val })}>
                    <SelectTrigger className="border-slate-300 h-10">
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

                <div className="space-y-1">
                  <Label htmlFor="job_type" className="text-sm font-medium text-slate-700">Job Type</Label>
                  <Select value={formData.job_type} onValueChange={handleJobTypeChange}>
                    <SelectTrigger className="border-slate-300 h-10">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
                      <SelectItem value="Final Measure">Final Measure</SelectItem>
                      <SelectItem value="Installation">Installation</SelectItem>
                      <SelectItem value="On site Repair">On site Repair</SelectItem>
                      <SelectItem value="Investigation">Investigation</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Call Back">Call Back</SelectItem>
                      <SelectItem value="Emergency Repair">Emergency Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status" className="text-sm font-medium text-slate-700">Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger className="border-slate-300 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="expected_duration" className="text-sm font-medium text-slate-700">Duration (hours)</Label>
                  <Input
                    id="expected_duration"
                    type="number"
                    step="0.5"
                    value={formData.expected_duration || ""}
                    onChange={(e) => setFormData({ ...formData, expected_duration: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Duration"
                    className="border-slate-300 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="assigned_to" className="text-sm font-medium text-slate-700">Assign Technicians</Label>
                <MultiTechnicianSelect
                  selectedEmails={formData.assigned_to}
                  technicians={technicians}
                  onChange={handleTechnicianChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Schedule</span>
              
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="scheduled_date" className="text-sm font-medium text-slate-700">Date *</Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                    className="border-slate-300 h-10"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="scheduled_time" className="text-sm font-medium text-slate-700">Time</Label>
                  <Input
                    id="scheduled_time"
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="border-slate-300 h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Collapsible defaultOpen={false}>
            <Card className="shadow-sm border border-slate-200">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes & Additional Info</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-sm font-medium text-slate-700">Notes & Instructions</Label>
                    <RichTextEditor
                      value={formData.notes}
                      onChange={(value) => setFormData({ ...formData, notes: value })}
                      placeholder="Add any special instructions..."
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="additional_info" className="text-sm font-medium text-slate-700">Additional Info</Label>
                    <RichTextEditor
                      value={formData.additional_info}
                      onChange={(value) => setFormData({ ...formData, additional_info: value })}
                      placeholder="Add any additional information..."
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible defaultOpen={false}>
            <Card className="shadow-sm border border-slate-200">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Uploads</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Images</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('image-upload').click()}
                      disabled={uploadingImages}
                      className="border-slate-300 hover:bg-slate-50 w-full h-10"
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
                    {formData.image_urls && formData.image_urls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {formData.image_urls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img src={url} alt={`Upload ${index + 1}`} className="w-full h-20 object-cover rounded border border-slate-200" />
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

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Quote</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('quote-upload').click()}
                        disabled={uploadingQuote}
                        className="border-slate-300 hover:bg-slate-50 w-full h-10"
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
                      {formData.quote_url && (
                        <a href={formData.quote_url} target="_blank" rel="noopener noreferrer" 
                           className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          View Quote
                        </a>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Invoice</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('invoice-upload').click()}
                        disabled={uploadingInvoice}
                        className="border-slate-300 hover:bg-slate-50 w-full h-10"
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
                      {formData.invoice_url && (
                        <a href={formData.invoice_url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          View Invoice
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-2 shadow-sm">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-slate-300 hover:bg-slate-50 h-10 px-4 font-medium rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 h-10 px-4 font-medium rounded-lg"
            >
              {isSubmitting ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={showNewCustomerDialog} onOpenChange={(open) => {
        setShowNewCustomerDialog(open);
        if (!open) {
          setLiveDuplicates([]);
        }
      }}>
        <DialogContent className="rounded-lg max-w-lg border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new_customer_name" className="text-sm font-medium text-slate-700">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => handleNewCustomerNameChange(e.target.value)}
                className="border-slate-300 h-10"
              />
              {liveDuplicates.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-900 mb-2">Existing customers found:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {liveDuplicates.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleUseExistingCustomer(customer)}
                        className="w-full text-left p-2 bg-white border border-amber-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="font-medium text-sm text-slate-900">{customer.name}</div>
                        <div className="text-xs text-slate-600">
                          {customer.phone && <span>{customer.phone}</span>}
                          {customer.phone && customer.email && <span> • </span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_customer_phone" className="text-sm font-medium text-slate-700">Phone</Label>
              <Input
                id="new_customer_phone"
                type="tel"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                className="border-slate-300 h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_customer_email" className="text-sm font-medium text-slate-700">Email</Label>
              <Input
                id="new_customer_email"
                type="email"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                className="border-slate-300 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewCustomerDialog(false);
                setLiveDuplicates([]);
              }}
              className="border-slate-300 font-medium h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewCustomer}
              disabled={!newCustomerData.name}
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-9 rounded-lg"
            >
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="rounded-lg max-w-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Potential Duplicates Found</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              We found {potentialDuplicates.length} existing customer{potentialDuplicates.length > 1 ? 's' : ''} that might match.
            </p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {potentialDuplicates.map((customer) => (
                <div 
                  key={customer.id}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleUseExistingCustomer(customer)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 text-sm">{customer.name}</h4>
                      <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                        {customer.phone && <p>Phone: {customer.phone}</p>}
                        {customer.email && <p>Email: {customer.email}</p>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseExistingCustomer(customer);
                      }}
                      className="border-slate-300 font-medium h-8 px-3 rounded-lg"
                    >
                      Use This
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-2">New customer:</p>
              <div className="p-2 bg-slate-50 rounded-lg text-sm">
                <p className="font-medium text-slate-900">{newCustomerData.name}</p>
                {newCustomerData.phone && <p className="text-slate-600 text-xs">Phone: {newCustomerData.phone}</p>}
                {newCustomerData.email && <p className="text-slate-600 text-xs">Email: {newCustomerData.email}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDuplicateDialog(false);
                setShowNewCustomerDialog(true);
              }}
              className="border-slate-300 font-medium h-9 rounded-lg"
            >
              Go Back
            </Button>
            <Button 
              onClick={handleForceCreateNew}
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-9 rounded-lg"
            >
              Create New Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
