import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, FileText, X, Image as ImageIcon, Upload, Trash2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PROJECT_STAGES } from "@/components/domain/projectStages";
import { PROJECT_TYPE_OPTIONS } from "@/components/domain/projectConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import RichTextField from "../common/RichTextField";
import AddressAutocomplete from "../common/AddressAutocomplete";
import { handleEnterToNextField } from "../common/formNavigator";

export default function ProjectForm({ project, onSubmit, onCancel, isSubmitting }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(project || {
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    title: "",
    description: "",
    project_type: "Garage Door Install",
    status: PROJECT_STAGES[0],
    financial_status: "",
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
    quote_value: null,
    invoice_value: null,
    payment_received: null,
    assigned_technicians: [],
    assigned_technicians_names: [],
    notes: "",
    image_urls: [],
    quote_url: "",
    invoice_url: "",
    doors: [],
    contract_id: "",
    opened_date: ""
  });

  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ 
    name: "", 
    phone: "", 
    email: "",
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null,
    organisation_id: ""
  });
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: "",
    organisation_type: undefined,
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null
  });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  const queryClient = useQueryClient();

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const customers = allCustomers.filter(c => c.status === 'active' && !c.deleted_at);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list()
  });

  const { data: allOrganisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.list()
  });

  const organisations = allOrganisations.filter(org => !org.deleted_at && org.status === 'active');

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: async (newCustomer) => {
      await queryClient.refetchQueries({ queryKey: ['customers'] });
      setFormData({
        ...formData,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || "",
        // Auto-populate project address from new customer
        address: newCustomer.address_full || "",
        address_full: newCustomer.address_full || "",
        address_street: newCustomer.address_street || "",
        address_suburb: newCustomer.address_suburb || "",
        address_state: newCustomer.address_state || "",
        address_postcode: newCustomer.address_postcode || "",
        address_country: newCustomer.address_country || "Australia",
        google_place_id: newCustomer.google_place_id || "",
        latitude: newCustomer.latitude || null,
        longitude: newCustomer.longitude || null
      });
      setShowNewCustomerDialog(false);
      setNewCustomerData({ 
        name: "", 
        phone: "", 
        email: "",
        address_full: "",
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
      customer_email: customer?.email || "",
      address: customer?.address_full || customer?.address || formData.address,
      address_full: customer?.address_full || customer?.address || formData.address_full,
      address_street: customer?.address_street || formData.address_street,
      address_suburb: customer?.address_suburb || formData.address_suburb,
      address_state: customer?.address_state || formData.address_state,
      address_postcode: customer?.address_postcode || formData.address_postcode,
      address_country: customer?.address_country || formData.address_country || "Australia",
      google_place_id: customer?.google_place_id || formData.google_place_id,
      latitude: customer?.latitude || formData.latitude,
      longitude: customer?.longitude || formData.longitude
    });
  };

  const handleTechnicianToggle = (techEmail) => {
    const tech = technicians.find(t => t.email === techEmail);
    const currentTechs = formData.assigned_technicians || [];
    const currentNames = formData.assigned_technicians_names || [];
    
    if (currentTechs.includes(techEmail)) {
      setFormData({
        ...formData,
        assigned_technicians: currentTechs.filter(e => e !== techEmail),
        assigned_technicians_names: currentNames.filter(n => n !== tech?.full_name)
      });
    } else {
      setFormData({
        ...formData,
        assigned_technicians: [...currentTechs, techEmail],
        assigned_technicians_names: [...currentNames, tech?.full_name]
      });
    }
  };

  const handleCreateCustomer = () => {
    const customerData = { 
      ...newCustomerData, 
      status: "active" 
    };
    
    // Get organisation_name if organisation_id is set
    if (customerData.organisation_id) {
      const org = organisations.find(o => o.id === customerData.organisation_id);
      customerData.organisation_name = org?.name || "";
    }
    
    createCustomerMutation.mutate(customerData);
  };

  const createOrganisationMutation = useMutation({
    mutationFn: (data) => base44.entities.Organisation.create(data),
    onSuccess: async (newOrg) => {
      await queryClient.refetchQueries({ queryKey: ['organisations'] });
      setNewCustomerData(prev => ({
        ...prev,
        organisation_id: newOrg.id
      }));
      setShowNewOrgDialog(false);
      setNewOrgData({
        name: "",
        organisation_type: undefined,
        address_full: "",
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null
      });
    }
  });

  const handleCreateOrganisation = () => {
    if (!newOrgData.name?.trim()) return;
    
    const submitData = {
      name: newOrgData.name.trim(),
      status: 'active'
    };
    
    if (newOrgData.organisation_type) {
      submitData.organisation_type = newOrgData.organisation_type;
    }
    if (newOrgData.address_full) {
      submitData.address_full = newOrgData.address_full;
      submitData.address = newOrgData.address_full;
      submitData.address_street = newOrgData.address_street;
      submitData.address_suburb = newOrgData.address_suburb;
      submitData.address_state = newOrgData.address_state;
      submitData.address_postcode = newOrgData.address_postcode;
      submitData.address_country = newOrgData.address_country || "Australia";
      submitData.google_place_id = newOrgData.google_place_id;
      submitData.latitude = newOrgData.latitude;
      submitData.longitude = newOrgData.longitude;
    }
    
    createOrganisationMutation.mutate(submitData);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFiles(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, quote_url: file_url });
    } catch (error) {
      console.error("Error uploading file:", error);
    }
    setUploadingFiles(false);
  };

  const removeImage = (indexToRemove) => {
    setFormData({
      ...formData,
      image_urls: formData.image_urls.filter((_, index) => index !== indexToRemove)
    });
  };

  const addDoor = () => {
    setFormData({
      ...formData,
      doors: [...(formData.doors || []), { height: "", width: "", type: "", style: "" }]
    });
  };

  const removeDoor = (indexToRemove) => {
    setFormData({
      ...formData,
      doors: formData.doors.filter((_, index) => index !== indexToRemove)
    });
  };

  const updateDoor = (index, field, value) => {
    const updatedDoors = [...formData.doors];
    updatedDoors[index] = { ...updatedDoors[index], [field]: value };
    setFormData({ ...formData, doors: updatedDoors });
  };

  const isInstallType = formData.project_type && (formData.project_type.includes("Install") || formData.project_type === "Multiple");

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const query = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }, [customers, customerSearchQuery]);

  const selectedCustomer = customers.find(c => c.id === formData.customer_id);

  return (
    <>
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-center gap-4">
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (onCancel) onCancel();
                navigate(-1);
              }}
              className="hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              {project ? 'Edit Project' : 'Create New Project'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit} onKeyDownCapture={handleEnterToNextField}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                data-nav="true"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Garage Door Replacement - Unit 6"
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <div className="flex gap-2">
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between border-2 border-slate-300 focus:border-[#fae008] h-10"
                    >
                      {selectedCustomer ? selectedCustomer.name : "Select customer"}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[9999]" align="start" sideOffset={5}>
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search customers..." 
                        value={customerSearchQuery}
                        onValueChange={setCustomerSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {filteredCustomers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.id}
                              keywords={[customer.name, customer.email, customer.phone]}
                              onSelect={(value) => {
                                handleCustomerChange(value);
                                setCustomerSearchOpen(false);
                                setCustomerSearchQuery("");
                              }}
                            >
                              <div className="flex flex-col w-full">
                                <span className="font-medium">{customer.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {[customer.email, customer.phone].filter(Boolean).join(" • ")}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCustomerDialog(true)}
                  className="border-2 border-slate-300 hover:bg-[#fae008]/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_id">Linked Contract (Optional)</Label>
              <Select
                value={formData.contract_id || "none"}
                onValueChange={(val) => setFormData({ ...formData, contract_id: val === "none" ? "" : val })}
              >
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue placeholder="Select a contract" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Project Address</Label>
              <AddressAutocomplete
                id="address"
                value={formData.address_full || formData.address || ""}
                onChange={(addressData) => setFormData({ 
                  ...formData, 
                  ...addressData,
                  address: addressData.address_full // Keep legacy field for backward compatibility
                })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="project_type">Type</Label>
                <Select value={formData.project_type} onValueChange={(val) => setFormData({ ...formData, project_type: val })}>
                  <SelectTrigger className="border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isInstallType && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Doors</h3>
                  <Button
                    type="button"
                    onClick={addDoor}
                    size="sm"
                    className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Door
                  </Button>
                </div>

                {formData.doors && formData.doors.length > 0 ? (
                  <div className="space-y-4">
                    {formData.doors.map((door, index) => (
                      <div key={index} className="bg-white border-2 border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-medium text-slate-700 leading-[1.4]">Door {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDoor(index)}
                            className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[12px] leading-[1.35]">Height</Label>
                            <Input
                              value={door.height}
                              onChange={(e) => updateDoor(index, 'height', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              placeholder="e.g., 2.4m"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[12px] leading-[1.35]">Width</Label>
                            <Input
                              value={door.width}
                              onChange={(e) => updateDoor(index, 'width', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              placeholder="e.g., 5.0m"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[12px] leading-[1.35]">Type</Label>
                            <Input
                              value={door.type}
                              onChange={(e) => updateDoor(index, 'type', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              placeholder="e.g., Sectional, Roller"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[12px] leading-[1.35]">Style</Label>
                            <Input
                              value={door.style}
                              onChange={(e) => updateDoor(index, 'style', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              placeholder="e.g., Modern, Classic"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500">
                    <p className="text-[14px] leading-[1.4] mb-2">No doors added yet</p>
                    <Button
                      type="button"
                      onClick={addDoor}
                      size="sm"
                      variant="outline"
                      className="border-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Door
                    </Button>
                  </div>
                )}
              </div>
            )}

            <RichTextField
              label="Description"
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="Describe the project scope and requirements…"
            />

            <RichTextField
              label="Notes"
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any extra notes or context for the team…"
              helperText="Internal only"
            />

            <div className="space-y-4 pt-4 border-t-2 border-slate-200">
              <h3 className="font-bold text-[#000000] tracking-tight">Attachments</h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#000000]">Images</Label>
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
                    accept="image/*,video/*"
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

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#000000]">Files</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload').click()}
                    disabled={uploadingFiles}
                    className="border-2 hover:bg-slate-100"
                  >
                    {uploadingFiles ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Upload Files</>
                    )}
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {formData.quote_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFormData({ ...formData, quote_url: "" })}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.quote_url && (
                  <a href={formData.quote_url} target="_blank" rel="noopener noreferrer" 
                     className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    View File
                  </a>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-6 bg-slate-50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (onCancel) onCancel();
                navigate(-1);
              }}
              className="border-2 hover:bg-white font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              data-nav="true"
              disabled={isSubmitting} 
              className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
            >
              {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="rounded-2xl border-2 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_customer_name">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                placeholder="Customer name"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_phone">Phone</Label>
              <Input
                id="new_customer_phone"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                placeholder="Phone number"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_email">Email</Label>
              <Input
                id="new_customer_email"
                type="email"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                placeholder="Email address"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_organisation">Organisation (Optional)</Label>
              <div className="flex gap-2">
                <Select value={newCustomerData.organisation_id || "none"} onValueChange={(val) => setNewCustomerData({ ...newCustomerData, organisation_id: val === "none" ? "" : val })}>
                  <SelectTrigger className="border-2 border-slate-300 flex-1">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {organisations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}{org.organisation_type ? ` (${org.organisation_type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewOrgDialog(true)}
                  className="border-2 border-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_address">Address</Label>
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
              onClick={() => setShowNewCustomerDialog(false)}
              className="border-2 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCustomer}
              disabled={!newCustomerData.name || createCustomerMutation.isPending}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="rounded-2xl border-2 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_org_name">Name *</Label>
              <Input
                id="new_org_name"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_org_type">Type</Label>
              <Select value={newOrgData.organisation_type || ""} onValueChange={(val) => setNewOrgData({ ...newOrgData, organisation_type: val || undefined })}>
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strata">Strata</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Supplier">Supplier</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_org_address">Address</Label>
              <AddressAutocomplete
                id="new_org_address"
                value={newOrgData.address_full || ""}
                onChange={(addressData) => setNewOrgData({ 
                  ...newOrgData, 
                  ...addressData
                })}
                className="border-2 border-slate-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setShowNewOrgDialog(false)}
              className="border-2 font-semibold"
              disabled={createOrganisationMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleCreateOrganisation}
              disabled={!newOrgData.name || createOrganisationMutation.isPending}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {createOrganisationMutation.isPending ? 'Creating...' : 'Create Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}