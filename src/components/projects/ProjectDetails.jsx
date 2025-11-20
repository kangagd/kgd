import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, User, Upload, X, Briefcase, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EditableField from "../jobs/EditableField";
import RichTextEditor from "../common/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ProjectChangeHistoryModal from "./ProjectChangeHistoryModal";
import ProjectStageSelector from "./ProjectStageSelector";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-800",
  "Initial Site Visit": "bg-blue-100 text-blue-800",
  "Quote Sent": "bg-purple-100 text-purple-800",
  "Quote Approved": "bg-indigo-100 text-indigo-800",
  "Final Measure": "bg-cyan-100 text-cyan-800",
  "Parts Ordered": "bg-amber-100 text-amber-800",
  "Scheduled": "bg-[#fae008]/20 text-[hsl(25,10%,12%)]",
  "Completed": "bg-emerald-100 text-emerald-800"
};

const financialStatusColors = {
  "50% payment made": "bg-yellow-100 text-yellow-800",
  "30% payment made (install)": "bg-orange-100 text-orange-800",
  "Balance paid in full": "bg-green-100 text-green-800"
};

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Multiple": "bg-pink-100 text-pink-700",
  "Motor/Accessory": "bg-cyan-100 text-cyan-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-blue-100 text-blue-800",
  "Completed": "bg-emerald-100 text-emerald-800",
  "Cancelled": "bg-red-100 text-red-800"
};

export default function ProjectDetails({ project, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(project.description || "");
  const [notes, setNotes] = useState(project.notes || "");
  const [uploading, setUploading] = useState(false);
  const [newDoor, setNewDoor] = useState({ height: "", width: "", type: "", style: "" });
  const [showAddDoor, setShowAddDoor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: projectJobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: () => base44.entities.Job.filter({ project_id: project.id })
  });

  const jobs = projectJobs.filter(j => !j.deleted_at);

  const { data: customer } = useQuery({
    queryKey: ['customer', project.customer_id],
    queryFn: () => base44.entities.Customer.get(project.customer_id),
    enabled: !!project.customer_id
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const handleAddJob = () => {
    navigate(createPageUrl("Jobs") + `?action=new&projectId=${project.id}`);
  };

  const handleJobClick = (jobId) => {
    navigate(createPageUrl("Jobs") + `?jobId=${jobId}`);
  };

  const handleCustomerClick = () => {
    if (customer) {
      navigate(createPageUrl("Customers") + `?customerId=${customer.id}`);
    }
  };

  const handleFieldSave = async (fieldName, oldValue, newValue) => {
    if (oldValue !== newValue) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: fieldName,
        old_value: String(oldValue),
        new_value: String(newValue),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
    }
    updateProjectMutation.mutate({ field: fieldName, value: newValue });
  };

  const handleDescriptionBlur = async () => {
    if (description !== project.description) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'description',
        old_value: String(project.description || ''),
        new_value: String(description),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
      updateProjectMutation.mutate({ field: 'description', value: description });
    }
  };

  const handleNotesBlur = async () => {
    if (notes !== project.notes) {
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'notes',
        old_value: String(project.notes || ''),
        new_value: String(notes),
        changed_by: user.email,
        changed_by_name: user.full_name
      });
      updateProjectMutation.mutate({ field: 'notes', value: notes });
    }
  };

  const handleTechniciansChange = (emails) => {
    const emailsArray = Array.isArray(emails) ? emails : [];
    const techNames = emailsArray.map(email => {
      const tech = technicians.find(t => t.email === email);
      return tech?.full_name || "";
    }).filter(Boolean);
    updateProjectMutation.mutate({ field: 'assigned_technicians', value: emailsArray });
    updateProjectMutation.mutate({ field: 'assigned_technicians_names', value: techNames });
  };

  const handleFileUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (type === 'image') {
        const currentImages = project.image_urls || [];
        updateProjectMutation.mutate({ 
          field: 'image_urls', 
          value: [...currentImages, file_url] 
        });
      } else if (type === 'quote') {
        updateProjectMutation.mutate({ field: 'quote_url', value: file_url });
      } else if (type === 'invoice') {
        updateProjectMutation.mutate({ field: 'invoice_url', value: file_url });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    const updatedImages = project.image_urls.filter((_, index) => index !== indexToRemove);
    updateProjectMutation.mutate({ field: 'image_urls', value: updatedImages });
  };

  const handleAddDoor = () => {
    if (!newDoor.height && !newDoor.width && !newDoor.type) return;
    
    const currentDoors = project.doors || [];
    updateProjectMutation.mutate({ 
      field: 'doors', 
      value: [...currentDoors, newDoor] 
    });
    setNewDoor({ height: "", width: "", type: "", style: "" });
    setShowAddDoor(false);
  };

  const handleRemoveDoor = (indexToRemove) => {
    const updatedDoors = project.doors.filter((_, index) => index !== indexToRemove);
    updateProjectMutation.mutate({ field: 'doors', value: updatedDoors });
  };

  const isInstallType = project.project_type && project.project_type.includes("Install");

  return (
    <div className="relative">
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 flex-shrink-0 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#111827]" />
          </Button>

          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
            >
              <History className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(project)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600">
                    This project will be moved to the archive. Associated jobs will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(project.id)}
                    className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
            <div className="text-xs font-semibold text-[#4B5563] mb-1.5 uppercase tracking-wide">Project Stage</div>
            <ProjectStageSelector
              currentStage={project.status}
              onStageChange={(newStage) => handleFieldSave('status', project.status, newStage)}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <EditableField
              value={project.title}
              onSave={(val) => handleFieldSave('title', project.title, val)}
              type="text"
              placeholder="Project Title"
              className="text-xl font-semibold text-[#111827]"
            />
            {project.project_type && (
              <EditableField
                value={project.project_type}
                onSave={(val) => handleFieldSave('project_type', project.project_type, val)}
                type="select"
                options={[
                  { value: "Garage Door Install", label: "Garage Door Install" },
                  { value: "Gate Install", label: "Gate Install" },
                  { value: "Roller Shutter Install", label: "Roller Shutter Install" },
                  { value: "Multiple", label: "Multiple" },
                  { value: "Motor/Accessory", label: "Motor/Accessory" },
                  { value: "Repair", label: "Repair" },
                  { value: "Maintenance", label: "Maintenance" }
                ]}
                displayFormat={(val) => (
                  <Badge className={`${projectTypeColors[val]} font-semibold border-0 px-2.5 py-0.5 rounded-lg text-xs`}>
                    {val}
                  </Badge>
                )}
              />
            )}
            {project.financial_status && (
              <EditableField
                value={project.financial_status}
                onSave={(val) => handleFieldSave('financial_status', project.financial_status, val)}
                type="select"
                options={[
                  { value: "50% payment made", label: "50% payment made" },
                  { value: "30% payment made (install)", label: "30% payment made (install)" },
                  { value: "Balance paid in full", label: "Balance paid in full" }
                ]}
                displayFormat={(val) => (
                  <Badge className={`${financialStatusColors[val]} font-semibold border-0 px-2.5 py-0.5 rounded-lg text-xs`}>
                    {val}
                  </Badge>
                )}
              />
            )}
            {customer?.customer_type && (
              <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold px-2.5 py-0.5 rounded-lg text-xs">
                {customer.customer_type}
              </Badge>
            )}
          </div>

          <div 
            className="text-sm font-medium text-[#4B5563] cursor-pointer hover:text-[#FAE008] transition-colors"
            onClick={handleCustomerClick}
          >
            {project.customer_name}
          </div>
        </div>

        <div className="bg-[#ffffff] p-3 rounded-lg">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-[#4B5563]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#4B5563] font-medium mb-0.5">Address</div>
                <EditableField
                  value={project.address}
                  onSave={(val) => handleFieldSave('address', project.address, val)}
                  type="text"
                  placeholder="Set address"
                  className="font-semibold text-[#111827] text-sm"
                />
              </div>
            </div>
            {project.customer_phone && (
              <div className="flex items-center gap-2.5">
                <a href={`tel:${project.customer_phone}`} className="hover:bg-[#F3F4F6] p-1 rounded transition-colors">
                  <Phone className="w-5 h-5 text-[#4B5563]" />
                </a>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Phone</div>
                  <span className="font-semibold text-[#111827] text-sm">{project.customer_phone}</span>
                </div>
              </div>
            )}
            {project.customer_email && (
              <div className="flex items-center gap-2.5">
                <a href={`mailto:${project.customer_email}`} className="hover:bg-[#F3F4F6] p-1 rounded transition-colors">
                  <Mail className="w-5 h-5 text-[#4B5563]" />
                </a>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Email</div>
                  <span className="font-semibold text-[#111827] text-sm">{project.customer_email}</span>
                </div>
              </div>
            )}

          </div>
        </div>
        </CardHeader>

      <CardContent className="p-3 md:p-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-11 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-1">
            <TabsTrigger value="overview" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="images" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ImageIcon className="w-4 h-4 mr-1.5" />
              <span className="hidden md:inline">Images</span>
            </TabsTrigger>
            <TabsTrigger value="attachments" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4 mr-1.5" />
              <span className="hidden md:inline">Files</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Briefcase className="w-4 h-4 mr-1.5" />
              <span className="hidden md:inline">Visits</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-bold text-[#111827]">Description</h3>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  onBlur={handleDescriptionBlur}
                  placeholder="Add description..."
                />
              </CardContent>
            </Card>

            <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-bold text-[#111827]">Notes</h3>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <RichTextEditor
                  value={notes}
                  onChange={setNotes}
                  onBlur={handleNotesBlur}
                  placeholder="Add notes..."
                />
              </CardContent>
            </Card>

            {isInstallType && (
              <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden relative">
                <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#6B7280]" />
                      <h3 className="text-sm font-bold text-[#111827]">Installation Details</h3>
                    </div>
                    {!showAddDoor && (
                      <button
                        onClick={() => setShowAddDoor(true)}
                        className="w-8 h-8 bg-[#FAE008] hover:bg-[#E5CF07] rounded-lg flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[#111827]" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {project.doors && project.doors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.doors.map((door, idx) => (
                        <div key={idx} className="relative group">
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-medium px-3 py-1.5 text-sm pr-8">
                            Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                            {door.type && ` • ${door.type}`}
                            {door.style && ` • ${door.style}`}
                          </Badge>
                          <button
                            onClick={() => handleRemoveDoor(idx)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showAddDoor && (
                    <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F8F9FA]">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        <Input
                          placeholder="Height"
                          value={newDoor.height}
                          onChange={(e) => setNewDoor({ ...newDoor, height: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder="Width"
                          value={newDoor.width}
                          onChange={(e) => setNewDoor({ ...newDoor, width: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder="Type"
                          value={newDoor.type}
                          onChange={(e) => setNewDoor({ ...newDoor, type: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder="Style"
                          value={newDoor.style}
                          onChange={(e) => setNewDoor({ ...newDoor, style: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddDoor}
                          size="sm"
                          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-8"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Door
                        </Button>
                        <Button
                          onClick={() => setShowAddDoor(false)}
                          size="sm"
                          variant="outline"
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="images" className="mt-3">
            <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-bold text-[#111827]">Images</h3>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {project.image_urls && project.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {project.image_urls.map((url, index) => (
                      <div key={index} className="relative group">
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img 
                            src={url} 
                            alt={`Project image ${index + 1}`} 
                            className="w-full h-24 object-cover rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] transition-all"
                          />
                        </a>
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10"
                    disabled={uploading}
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Add Image'}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'image')}
                  />
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments" className="mt-3">
            <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-bold text-[#111827]">Documents</h3>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {(project.quote_url || project.invoice_url) && (
                  <div className="space-y-2">
                    {project.quote_url && (
                      <a 
                        href={project.quote_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all"
                      >
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-[#111827]">Quote Document</span>
                      </a>
                    )}
                    {project.invoice_url && (
                      <a 
                        href={project.invoice_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all"
                      >
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-[#111827]">Invoice Document</span>
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <label className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        <FileText className="w-4 h-4 mr-2" />
                        Upload Quote
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'quote')}
                    />
                  </label>
                  <label className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        <FileText className="w-4 h-4 mr-2" />
                        Upload Invoice
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'invoice')}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="mt-3">
            <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#6B7280]" />
                    <h3 className="text-sm font-bold text-[#111827]">Visits ({jobs.length})</h3>
                  </div>
                  <Button
                    onClick={handleAddJob}
                    className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9 text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Visit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {jobs.length === 0 ? (
                  <div className="text-center py-8 bg-[#F8F9FA] rounded-lg">
                    <p className="text-[#6B7280] mb-3 text-sm">No visits yet</p>
                    <Button onClick={handleAddJob} className="bg-[#FAE008] text-[#111827] font-semibold h-10">
                      Create First Visit
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => handleJobClick(job.id)}
                        className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-[#FAE008] hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                                #{job.job_number}
                              </Badge>
                              <Badge className={`${jobStatusColors[job.status]} hover:${jobStatusColors[job.status]} border-0 font-semibold text-xs px-3 py-1 rounded-lg`}>
                                {job.status}
                              </Badge>
                              {job.job_type_name && (
                                <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                                  {job.job_type_name}
                                </Badge>
                              )}
                            </div>
                            
                            {job.scheduled_date && (
                              <p className="text-sm text-[#4B5563]">
                                {new Date(job.scheduled_date).toLocaleDateString()}
                                {job.scheduled_time && ` • ${job.scheduled_time}`}
                              </p>
                            )}
                            
                            {job.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#4B5563]" />
                                <span className="text-sm text-[#4B5563]">{job.address}</span>
                              </div>
                            )}
                          </div>
                          
                          {job.assigned_to && job.assigned_to.length > 0 && (
                            <div className="flex-shrink-0">
                              {job.assigned_to.length === 1 ? (
                                <div className="w-10 h-10 bg-[#FAE008] rounded-full flex items-center justify-center">
                                  <span className="text-[#111827] font-semibold text-sm">
                                    {job.assigned_to_name?.[0]?.charAt(0)?.toUpperCase() || job.assigned_to[0]?.charAt(0)?.toUpperCase() || 'T'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex -space-x-2">
                                  {job.assigned_to.slice(0, 3).map((email, idx) => (
                                    <div key={idx} className="w-10 h-10 bg-[#FAE008] rounded-full flex items-center justify-center border-2 border-white">
                                      <span className="text-[#111827] font-semibold text-sm">
                                        {job.assigned_to_name?.[idx]?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'T'}
                                      </span>
                                    </div>
                                  ))}
                                  {job.assigned_to.length > 3 && (
                                    <div className="w-10 h-10 bg-[#E5E7EB] rounded-full flex items-center justify-center border-2 border-white">
                                      <span className="text-[#111827] font-semibold text-xs">
                                        +{job.assigned_to.length - 3}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>

      <ProjectChangeHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        projectId={project.id}
      />
      </Card>

      <Button
        onClick={handleAddJob}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] z-50 hover:scale-105 transition-all"
        size="icon"
        title="Add New Visit"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}