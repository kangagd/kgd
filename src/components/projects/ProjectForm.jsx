import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, FileText, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import RichTextEditor from "../common/RichTextEditor";

export default function ProjectForm({ project, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(project || {
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    title: "",
    description: "",
    project_type: "Garage Door Install",
    status: "open",
    stage: "lead_in",
    address: "",
    quote_value: null,
    invoice_value: null,
    payment_received: null,
    assigned_technicians: [],
    assigned_technicians_names: [],
    notes: "",
    image_urls: [],
    quote_url: "",
    invoice_url: "",
    doors: []
  });

  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", email: "" });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

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

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: async (newCustomer) => {
      await queryClient.refetchQueries({ queryKey: ['customers'] });
      setFormData({
        ...formData,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || ""
      });
      setShowNewCustomerDialog(false);
      setNewCustomerData({ name: "", phone: "", email: "" });
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
      address: customer?.address || formData.address
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
    createCustomerMutation.mutate({ ...newCustomerData, status: "active" });
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

  const isInstallType = formData.project_type && formData.project_type.includes("Install");

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
                {project ? 'Edit Project' : 'Create New Project'}
              </h1>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project Information</span>
              
              <div className="space-y-1">
                <Label htmlFor="title" className="text-sm font-medium text-slate-700">Project Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Garage Door Replacement - Unit 6"
                  className="border-slate-300 h-10"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="customer_id" className="text-sm font-medium text-slate-700">Customer *</Label>
                <div className="flex gap-2">
                  <Select value={formData.customer_id} onValueChange={handleCustomerChange} required>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewCustomerDialog(true)}
                    className="border-slate-300 hover:bg-slate-50 h-10 w-10 p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700">Project Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="border-slate-300 h-10"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="project_type" className="text-sm font-medium text-slate-700">Type</Label>
                  <Select value={formData.project_type} onValueChange={(val) => setFormData({ ...formData, project_type: val })}>
                    <SelectTrigger className="border-slate-300 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Garage Door Install">Garage Door Install</SelectItem>
                      <SelectItem value="Gate Install">Gate Install</SelectItem>
                      <SelectItem value="Roller Shutter Install">Roller Shutter Install</SelectItem>
                      <SelectItem value="Repair">Repair</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
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
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="stage" className="text-sm font-medium text-slate-700">Current Stage</Label>
                <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                  <SelectTrigger className="border-slate-300 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_in">Lead In</SelectItem>
                    <SelectItem value="measure">Measure</SelectItem>
                    <SelectItem value="quote_prepared">Quote Prepared</SelectItem>
                    <SelectItem value="quote_sent">Quote Sent</SelectItem>
                    <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
                    <SelectItem value="materials_ordered">Materials Ordered</SelectItem>
                    <SelectItem value="installation_scheduled">Installation Scheduled</SelectItem>
                    <SelectItem value="installation_completed">Installation Completed</SelectItem>
                    <SelectItem value="qa_aftercare">QA / Aftercare</SelectItem>
                    <SelectItem value="final_invoice">Final Invoice</SelectItem>
                    <SelectItem value="project_closed">Project Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isInstallType && (
            <Card className="shadow-sm border border-slate-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Installation Details</span>
                  <Button
                    type="button"
                    onClick={addDoor}
                    size="sm"
                    className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 h-8 px-3 font-medium rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Door
                  </Button>
                </div>

                {formData.doors && formData.doors.length > 0 ? (
                  <div className="space-y-2">
                    {formData.doors.map((door, index) => (
                      <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Door {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDoor(index)}
                            className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Height</Label>
                            <Input
                              value={door.height}
                              onChange={(e) => updateDoor(index, 'height', e.target.value)}
                              placeholder="e.g., 2.4m"
                              className="border-slate-300 h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Width</Label>
                            <Input
                              value={door.width}
                              onChange={(e) => updateDoor(index, 'width', e.target.value)}
                              placeholder="e.g., 5.0m"
                              className="border-slate-300 h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Type</Label>
                            <Input
                              value={door.type}
                              onChange={(e) => updateDoor(index, 'type', e.target.value)}
                              placeholder="e.g., Sectional"
                              className="border-slate-300 h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-600">Style</Label>
                            <Input
                              value={door.style}
                              onChange={(e) => updateDoor(index, 'style', e.target.value)}
                              placeholder="e.g., Modern"
                              className="border-slate-300 h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500 mb-2">No doors added yet</p>
                    <Button
                      type="button"
                      onClick={addDoor}
                      size="sm"
                      variant="outline"
                      className="border-slate-300 h-8 px-3 font-medium rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add First Door
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Collapsible defaultOpen={false}>
            <Card className="shadow-sm border border-slate-200">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assigned Team</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {technicians.map((tech) => (
                      <label key={tech.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={(formData.assigned_technicians || []).includes(tech.email)}
                          onChange={() => handleTechnicianToggle(tech.email)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">{tech.full_name}</span>
                      </label>
                    ))}
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
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description & Notes</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description</Label>
                    <RichTextEditor
                      value={formData.description}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                      placeholder="Describe the project scope..."
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-sm font-medium text-slate-700">Notes</Label>
                    <RichTextEditor
                      value={formData.notes}
                      onChange={(value) => setFormData({ ...formData, notes: value })}
                      placeholder="Additional notes..."
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
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Attachments</span>
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

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Files</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload').click()}
                      disabled={uploadingFiles}
                      className="border-slate-300 hover:bg-slate-50 w-full h-10"
                    >
                      {uploadingFiles ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                      ) : (
                        <><FileText className="w-4 h-4 mr-2" />Upload Files</>
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
                      <a href={formData.quote_url} target="_blank" rel="noopener noreferrer" 
                         className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        View File
                      </a>
                    )}
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
              {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="rounded-lg border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new_customer_name" className="text-sm font-medium text-slate-700">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                placeholder="Customer name"
                className="border-slate-300 h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_customer_phone" className="text-sm font-medium text-slate-700">Phone</Label>
              <Input
                id="new_customer_phone"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                placeholder="Phone number"
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
                placeholder="Email address"
                className="border-slate-300 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewCustomerDialog(false)}
              className="border-slate-300 font-medium h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={!newCustomerData.name || createCustomerMutation.isPending}
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-9 rounded-lg"
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}