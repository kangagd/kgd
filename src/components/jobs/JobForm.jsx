import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon, Loader2, Plus, Sparkles, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { JOB_STATUS, JOB_STATUS_OPTIONS } from "@/components/domain/jobConfig";
import { PROJECT_TYPE } from "@/components/domain/projectConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import MultiTechnicianSelect from "./MultiTechnicianSelect";
import RichTextField from "../common/RichTextField";
import AddressAutocomplete from "../common/AddressAutocomplete";

export default function JobForm({ job, technicians, onSubmit, onCancel, isSubmitting, preselectedCustomerId, preselectedProjectId, createJobContext }) {
  // Detect logistics context from URL params or props
  const urlParams = new URLSearchParams(window.location.search);
  const sourceParam = urlParams.get('source');
  const isLogisticsContext = createJobContext === 'purchase_order' || 
                             createJobContext === 'logistics_timeline' ||
                             sourceParam === 'purchase_order' || 
                             sourceParam === 'logistics_timeline';

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
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null,
    product: "",
    job_type_id: "",
    job_type: "",
    assigned_to: [],
    assigned_to_name: [],
    scheduled_date: "",
    scheduled_time: "",
    expected_duration: null,
    status: JOB_STATUS.OPEN,
    outcome: "",
    notes: "",
    pricing_provided: "",
    additional_info: "",
    measurements: null,
    image_urls: [],
    quote_url: "",
    invoice_url: "",
  });

  const [isLogisticsJob, setIsLogisticsJob] = useState(isLogisticsContext);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingQuote, setUploadingQuote] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", email: "", address_full: "", address_street: "", address_suburb: "", address_state: "", address_postcode: "", address_country: "Australia", google_place_id: "", latitude: null, longitude: null });
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

  const { data: allJobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true })
  });

  // Filter job types based on logistics toggle (only when creating new job)
  const jobTypes = !job ? allJobTypes.filter(jt => 
    isLogisticsJob ? (jt.is_logistics === true) : (jt.is_logistics !== true)
  ).sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999)) : allJobTypes;

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0 && !job) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customer_id: preselectedCustomerId,
          customer_name: customer.name,
          customer_phone: customer.phone || "",
          customer_email: customer.email || "",
          customer_type: customer.customer_type || "",
          address: customer.address || prev.address,
        }));
      }
    }
  }, [preselectedCustomerId, customers.length, job]);

  const generateNotes = async (project, jobTypeId) => {
    if (!project || !jobTypeId) return;

    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    if (!jobType) return;

    try {
      const prompt = `Generate well-formatted job notes and instructions for a technician. Use HTML formatting for clear, easy-to-read output.

  Job Type: ${jobType.name}
  ${jobType.description ? `Job Type Description: ${jobType.description}` : ''}
  Project: ${project.title}
  Project Type: ${project.project_type}
  ${project.description ? `Project Description: ${project.description}` : ''}
  ${project.notes ? `Project Notes: ${project.notes}` : ''}
  Address: ${project.address || 'Not specified'}

  Format your response using HTML with:
  - <h3> for section headings
  - <ul> and <li> for bullet points
  - <p> for paragraphs
  - <strong> for emphasis on important items

  Include sections like:
  - Job Overview (brief summary)
  - Key Tasks (bullet list)
  - Important Notes (any special considerations)
  - Required Materials/Tools (if applicable)

  Keep it concise, practical, and focused on what the technician needs to know and do.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt
      });

      setFormData(prev => ({ ...prev, notes: response }));
    } catch (error) {
      console.error("Failed to generate notes:", error);
    }
  };



  useEffect(() => {
    if (preselectedProjectId && projects.length > 0 && !job) {
      const project = projects.find(p => p.id === preselectedProjectId);
      if (project) {
        const productMapping = {
          [PROJECT_TYPE.GARAGE_DOOR_INSTALL]: "Garage Door",
          [PROJECT_TYPE.GATE_INSTALL]: "Gate",
          [PROJECT_TYPE.ROLLER_SHUTTER_INSTALL]: "Roller Shutter",
          [PROJECT_TYPE.MULTIPLE]: "Multiple"
        };

        const autoProduct = productMapping[project.project_type] || "";

        setFormData(prev => ({
          ...prev,
          project_id: preselectedProjectId,
          project_name: project.title,
          customer_id: project.customer_id,
          customer_name: project.customer_name,
          customer_phone: project.customer_phone || "",
          customer_email: project.customer_email || "",
          address: project.address || prev.address,
          product: autoProduct,
          additional_info: project.description || "",
          image_urls: project.image_urls || [],
          quote_url: project.quote_url || "",
          invoice_url: project.invoice_url || ""
        }));
      }
    }
  }, [preselectedProjectId, projects.length, job]);

  const handleAutoSave = async () => {
    if (!job && !formData.customer_id) {
      // Don't auto-save if no customer is selected
      onCancel();
      return;
    }

    // Validate job type matches logistics mode
    if (!job && formData.job_type_id) {
      const selectedJobType = allJobTypes.find(jt => jt.id === formData.job_type_id);
      if (selectedJobType) {
        const isSelectedLogistics = selectedJobType.is_logistics === true;
        if (isLogisticsJob !== isSelectedLogistics) {
          alert('Please select a job type that matches the logistics mode, or clear the job type selection.');
          return;
        }
      }
    }

    if (!job) {
      const allJobs = await base44.entities.Job.list('-job_number', 1);
      const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
      formData.job_number = lastJobNumber + 1;
    }
    
    const submitData = {
      ...formData,
      assigned_to: Array.isArray(formData.assigned_to) ? formData.assigned_to : [],
      assigned_to_name: Array.isArray(formData.assigned_to_name) ? formData.assigned_to_name : []
    };

    // Remove empty string values for enum fields
    if (!submitData.job_type_id) delete submitData.job_type_id;
    if (!submitData.job_type) delete submitData.job_type;
    if (!submitData.product) delete submitData.product;
    if (!submitData.outcome) delete submitData.outcome;
    
    onSubmit(submitData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleAutoSave();
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
        address: customer.address_full || customer.address || formData.address,
        address_full: customer.address_full || customer.address || formData.address_full,
        address_street: customer.address_street || formData.address_street,
        address_suburb: customer.address_suburb || formData.address_suburb,
        address_state: customer.address_state || formData.address_state,
        address_postcode: customer.address_postcode || formData.address_postcode,
        address_country: customer.address_country || formData.address_country || "Australia",
        google_place_id: customer.google_place_id || formData.google_place_id,
        latitude: customer.latitude || formData.latitude,
        longitude: customer.longitude || formData.longitude,
      });
    }
  };

  const handleProjectChange = (projectId) => {
    if (!projectId || projectId === 'null') {
      setFormData({
        ...formData,
        project_id: "",
        project_name: "",
      });
    } else {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        // Map project type to product
        const productMapping = {
          [PROJECT_TYPE.GARAGE_DOOR_INSTALL]: "Garage Door",
          [PROJECT_TYPE.GATE_INSTALL]: "Gate",
          [PROJECT_TYPE.ROLLER_SHUTTER_INSTALL]: "Roller Shutter",
          [PROJECT_TYPE.MULTIPLE]: "Multiple"
        };
        
        const autoProduct = productMapping[project.project_type] || formData.product;
        
        setFormData({
          ...formData,
          project_id: projectId,
          project_name: project.title,
          customer_id: project.customer_id,
          customer_name: project.customer_name,
          customer_phone: project.customer_phone || "",
          customer_email: project.customer_email || "",
          address: project.address_full || project.address || formData.address,
          address_full: project.address_full || project.address || formData.address_full,
          address_street: project.address_street || formData.address_street,
          address_suburb: project.address_suburb || formData.address_suburb,
          address_state: project.address_state || formData.address_state,
          address_postcode: project.address_postcode || formData.address_postcode,
          address_country: project.address_country || formData.address_country || "Australia",
          google_place_id: project.google_place_id || formData.google_place_id,
          latitude: project.latitude || formData.latitude,
          longitude: project.longitude || formData.longitude,
          product: autoProduct
        });
      }
    }
  };

  const handleJobTypeChange = async (jobTypeId) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    if (jobType) {
      setFormData({
        ...formData,
        job_type_id: jobTypeId,
        job_type: jobType.name,
        expected_duration: jobType.estimated_duration || formData.expected_duration
      });

      // Generate notes if we have a project
      if (formData.project_id && !job) {
        const project = projects.find(p => p.id === formData.project_id);
        if (project) {
          await generateNotes(project, jobTypeId);
        }
      }
    }
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
        address: newCustomer.address_full || newCustomer.address || "",
        address_full: newCustomer.address_full || newCustomer.address || "",
        address_street: newCustomer.address_street || "",
        address_suburb: newCustomer.address_suburb || "",
        address_state: newCustomer.address_state || "",
        address_postcode: newCustomer.address_postcode || "",
        address_country: newCustomer.address_country || "Australia",
        google_place_id: newCustomer.google_place_id || "",
        latitude: newCustomer.latitude || null,
        longitude: newCustomer.longitude || null,
      });
      setShowNewCustomerDialog(false);
      setShowDuplicateDialog(false);
      setNewCustomerData({ name: "", phone: "", email: "", address_full: "", address_street: "", address_suburb: "", address_state: "", address_postcode: "", address_country: "Australia", google_place_id: "", latitude: null, longitude: null });
      setPotentialDuplicates([]);
      setLiveDuplicates([]);
    } catch (error) {
      console.error("Error creating customer:", error);
    }
  };

  const handleCreateNewCustomer = async () => {
    await checkForDuplicates();
  };

  const handleUseExistingCustomer = (customer) => {
    handleCustomerChange(customer.id);
    setShowDuplicateDialog(false);
    setShowNewCustomerDialog(false);
    setNewCustomerData({ name: "", phone: "", email: "", address_full: "", address_street: "", address_suburb: "", address_state: "", address_postcode: "", address_country: "Australia", google_place_id: "", latitude: null, longitude: null });
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
      return tech?.display_name || tech?.full_name || "";
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
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-center gap-4">
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={handleAutoSave}
              className="hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              {job ? `Edit Job #${job.job_number}` : formData.project_name ? `New Job - ${formData.project_name}` : 'Create New Job'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            {/* Logistics Toggle - Only show when creating new job */}
            {!job && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 flex-1">
                  <Truck className="w-5 h-5 text-[#6B7280]" />
                  <div className="flex-1">
                    <Label htmlFor="logistics-toggle" className="text-[14px] font-semibold text-[#111827] cursor-pointer">
                      Is this a logistics job?
                    </Label>
                    <p className="text-[12px] text-[#6B7280] mt-1">
                      Logistics jobs are for deliveries, pickups, and stock movement only
                    </p>
                  </div>
                </div>
                <Switch
                  id="logistics-toggle"
                  checked={isLogisticsJob}
                  onCheckedChange={(checked) => {
                    setIsLogisticsJob(checked);
                    // Reset job type when toggling if current selection is invalid
                    const currentJobType = allJobTypes.find(jt => jt.id === formData.job_type_id);
                    if (currentJobType) {
                      const isCurrentLogistics = currentJobType.is_logistics === true;
                      if (checked !== isCurrentLogistics) {
                        setFormData(prev => ({ ...prev, job_type_id: "", job_type: "" }));
                      }
                    }
                  }}
                  className="scale-110"
                />
              </div>
            )}

            {/* Contract Banner */}
            {/* We don't have contract data fetched directly here, but if customer has contract_id we can infer. 
                However, JobForm doesn't query full customer details for all dropdown items deeply. 
                But `customers` list is fetched. We can check selected customer. 
            */}
            {(() => {
               const selectedCustomer = customers.find(c => c.id === formData.customer_id);
               if (selectedCustomer && selectedCustomer.contract_id) {
                 return (
                   <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4 rounded-r">
                     <div className="flex items-center">
                       <div className="flex-shrink-0">
                         <FileText className="h-5 w-5 text-purple-500" />
                       </div>
                       <div className="ml-3">
                         <p className="text-sm text-purple-700">
                           <span className="font-bold">Contract Job:</span> This job will be linked to the customer's active contract.
                         </p>
                       </div>
                     </div>
                   </div>
                 );
               }
               return null;
            })()}

            {!preselectedProjectId && (
              <div className="space-y-2">
                <Label htmlFor="project_id" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Project (Optional)</Label>
                <Select 
                  value={formData.project_id || 'null'} 
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all">
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

            <div className="space-y-2">
              <Label htmlFor="customer_id" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Customer *</Label>
              <div className="flex gap-2">
                <Select 
                  value={formData.customer_id} 
                  onValueChange={handleCustomerChange} 
                  required
                  disabled={!!formData.project_id}
                >
                  <SelectTrigger className="flex-1 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all">
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
                    className="border-2 hover:bg-slate-100"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {formData.project_id && (
                <p className="text-[12px] text-slate-500 leading-[1.35]">Customer from project</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Service Address *</Label>
              <AddressAutocomplete
                id="address"
                value={formData.address_full || formData.address || ""}
                onChange={(addressData) => setFormData({ 
                  ...formData, 
                  ...addressData,
                  address: addressData.address_full // Keep legacy field for backward compatibility
                })}
                required
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Product</Label>
                <Select value={formData.product} onValueChange={(val) => setFormData({ ...formData, product: val })}>
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20">
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
                <Label htmlFor="job_type_id" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Job Type</Label>
                <Select value={formData.job_type_id} onValueChange={handleJobTypeChange}>
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map((jt) => (
                      <SelectItem key={jt.id} value={jt.id}>
                        {jt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Assign Technicians</Label>
                <MultiTechnicianSelect
                  selectedEmails={formData.assigned_to}
                  technicians={technicians}
                  onChange={handleTechnicianChange}
                />
                {formData.assigned_to && formData.assigned_to.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    {formData.assigned_to.map((email, idx) => {
                      const tech = technicians.find(t => t.email === email);
                      const name = tech?.display_name || tech?.full_name || formData.assigned_to_name[idx] || email;
                      const getInitials = (name) => {
                        if (!name) return "?";
                        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                      };
                      const avatarColors = [
                        "bg-blue-500",
                        "bg-purple-500",
                        "bg-green-500",
                        "bg-orange-500",
                        "bg-pink-500",
                        "bg-indigo-500",
                        "bg-red-500",
                        "bg-teal-500"
                      ];
                      const getAvatarColor = (name) => {
                        if (!name) return avatarColors[0];
                        const index = name.charCodeAt(0) % avatarColors.length;
                        return avatarColors[index];
                      };
                      return (
                        <div
                          key={email}
                          className={`${getAvatarColor(name)} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_date" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Scheduled Date *</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const newStatus = newDate ? JOB_STATUS.SCHEDULED : JOB_STATUS.OPEN;
                    setFormData({ 
                      ...formData, 
                      scheduled_date: newDate,
                      status: newStatus
                    });
                  }}
                  required
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_time" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Scheduled Time</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_duration" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Expected Duration (hours)</Label>
                <Input
                  id="expected_duration"
                  type="number"
                  step="0.5"
                  value={formData.expected_duration || ""}
                  onChange={(e) => setFormData({ ...formData, expected_duration: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Duration"
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
            </div>

            <RichTextField
              label="Notes & Instructions"
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any special instructions or notes for technicians…"
              helperText="Visible to technicians"
            />



            <div className="space-y-2">
              <Label htmlFor="pricing_provided" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Pricing Provided</Label>
              <Input
                id="pricing_provided"
                value={formData.pricing_provided}
                onChange={(e) => setFormData({ ...formData, pricing_provided: e.target.value })}
                placeholder="Enter pricing information provided to customer..."
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>

            <RichTextField
              label="Additional Info"
              value={formData.additional_info}
              onChange={(value) => setFormData({ ...formData, additional_info: value })}
              placeholder="Add any additional information or context…"
              helperText="Internal only"
            />

            <div className="space-y-4 pt-4 border-t-2 border-slate-200">
              <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">File Uploads</h3>
              
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#111827] leading-[1.4]">Images</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload').click()}
                    disabled={uploadingImages}
                    className="border-2 hover:bg-slate-100"
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
                        <img src={url} alt={`Upload ${index + 1}`} className="w-full h-24 object-cover rounded-lg border-2 border-slate-200" />
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
                  <Label className="text-[14px] font-medium text-[#111827] leading-[1.4]">Quote</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('quote-upload').click()}
                      disabled={uploadingQuote}
                      className="border-2 hover:bg-slate-100"
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
                       className="text-[14px] text-blue-600 leading-[1.4] hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      View Quote
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#111827] leading-[1.4]">Invoice</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('invoice-upload').click()}
                      disabled={uploadingInvoice}
                      className="border-2 hover:bg-slate-100"
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
                       className="text-[14px] text-blue-600 leading-[1.4] hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      View Invoice
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-6 bg-slate-50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-2 hover:bg-white font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
            >
              {isSubmitting ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={(open) => {
        setShowNewCustomerDialog(open);
        if (!open) {
          setLiveDuplicates([]);
        }
      }}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_customer_name" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => handleNewCustomerNameChange(e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
              {liveDuplicates.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border-2 border-amber-200 rounded-xl">
                  <p className="text-[12px] font-medium text-amber-900 leading-[1.35] mb-2">Existing customers found:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {liveDuplicates.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleUseExistingCustomer(customer)}
                        className="w-full text-left p-2 bg-white border border-amber-200 rounded-lg hover:border-[#fae008] hover:bg-slate-50 transition-all"
                      >
                        <div className="text-[14px] font-medium text-[#111827] leading-[1.4]">{customer.name}</div>
                        <div className="text-[12px] text-slate-600 leading-[1.35]">
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
            <div className="space-y-2">
              <Label htmlFor="new_customer_phone" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Phone</Label>
              <Input
                id="new_customer_phone"
                type="tel"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_email" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Email</Label>
              <Input
                id="new_customer_email"
                type="email"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_address" className="text-[14px] font-medium text-[#111827] leading-[1.4]">Address</Label>
              <AddressAutocomplete
                id="new_customer_address"
                value={newCustomerData.address_full || ""}
                onChange={(addressData) => setNewCustomerData({ 
                  ...newCustomerData, 
                  ...addressData
                })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                setShowNewCustomerDialog(false);
                setLiveDuplicates([]);
              }}
              className="border-2 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleCreateNewCustomer}
              disabled={!newCustomerData.name}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Potential Duplicate Customers Found</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[14px] text-slate-600 leading-[1.4]">
              We found {potentialDuplicates.length} existing customer{potentialDuplicates.length > 1 ? 's' : ''} that might match. 
              Would you like to use one of these instead?
            </p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {potentialDuplicates.map((customer) => (
                <div 
                  key={customer.id}
                  className="p-3 border-2 border-slate-200 rounded-xl hover:border-[#fae008] hover:bg-slate-50 cursor-pointer transition-all"
                  onClick={() => handleUseExistingCustomer(customer)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-[16px] font-medium text-[#111827] leading-[1.4]">{customer.name}</h4>
                      <div className="text-[14px] text-slate-600 leading-[1.4] space-y-0.5 mt-1">
                        {customer.phone && <p>Phone: {customer.phone}</p>}
                        {customer.email && <p>Email: {customer.email}</p>}
                        {customer.customer_type && (
                          <p className="text-[12px] text-slate-500 leading-[1.35]">Type: {customer.customer_type}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseExistingCustomer(customer);
                      }}
                      className="border-2 font-semibold"
                    >
                      Use This
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t-2 border-slate-200">
              <p className="text-[12px] text-slate-500 leading-[1.35] mb-3">
                New customer you're trying to create:
              </p>
              <div className="p-2 bg-slate-50 rounded-lg text-[14px] leading-[1.4]">
                <p className="font-medium text-[#111827]">{newCustomerData.name}</p>
                {newCustomerData.phone && <p className="text-slate-600">Phone: {newCustomerData.phone}</p>}
                {newCustomerData.email && <p className="text-slate-600">Email: {newCustomerData.email}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                setShowDuplicateDialog(false);
                setShowNewCustomerDialog(true);
              }}
              className="border-2 font-semibold"
            >
              Go Back
            </Button>
            <Button 
              type="button"
              onClick={handleForceCreateNew}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              Create New Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}