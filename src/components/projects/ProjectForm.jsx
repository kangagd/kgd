import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, FileText, X, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    status: "Lead",
    financial_status: "",
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
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCancel}
              className="hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
              {project ? 'Edit Project' : 'Create New Project'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
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
                <Select value={formData.customer_id} onValueChange={handleCustomerChange} required>
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008]">
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
                  className="border-2 border-slate-300 hover:bg-[#fae008]/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Project Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
                    <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                    <SelectItem value="Quote Approved">Quote Approved</SelectItem>
                    <SelectItem value="Final Measure">Final Measure</SelectItem>
                    <SelectItem value="Parts Ordered">Parts Ordered</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isInstallType && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#000000]">Doors</h3>
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
                          <span className="font-semibold text-sm text-slate-700">Door {index + 1}</span>
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
                            <Label className="text-xs">Height</Label>
                            <Input
                              value={door.height}
                              onChange={(e) => updateDoor(index, 'height', e.target.value)}
                              placeholder="e.g., 2.4m"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Width</Label>
                            <Input
                              value={door.width}
                              onChange={(e) => updateDoor(index, 'width', e.target.value)}
                              placeholder="e.g., 5.0m"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Input
                              value={door.type}
                              onChange={(e) => updateDoor(index, 'type', e.target.value)}
                              placeholder="e.g., Sectional, Roller"
                              className="border-2 border-slate-300 focus:border-[#fae008] h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Style</Label>
                            <Input
                              value={door.style}
                              onChange={(e) => updateDoor(index, 'style', e.target.value)}
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
                    <p className="text-sm mb-2">No doors added yet</p>
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <RichTextEditor
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Describe the project scope..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <RichTextEditor
                value={formData.notes}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Additional notes..."
              />
            </div>

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
              {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="rounded-2xl border-2 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#000000]">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_customer_name">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
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
                placeholder="Email address"
                className="border-2 border-slate-300 focus:border-[#fae008]"
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
              onClick={handleCreateCustomer}
              disabled={!newCustomerData.name || createCustomerMutation.isPending}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}