import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, User, Upload, X, Briefcase, History, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EditableField from "../jobs/EditableField";
import RichTextField from "../common/RichTextField";
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
import PartsSection from "./PartsSection";
import ProjectSummary from "./ProjectSummary";
import ProjectVisitsTab from "./ProjectVisitsTab";
import FinancialsTab from "./FinancialsTab";
import PhotoModal from "./PhotoModal";
import DocumentModal from "./DocumentModal";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-700",
  "Initial Site Visit": "bg-blue-100 text-blue-700",
  "Quote Sent": "bg-purple-100 text-purple-700",
  "Quote Approved": "bg-indigo-100 text-indigo-700",
  "Final Measure": "bg-cyan-100 text-cyan-700",
  "Parts Ordered": "bg-amber-100 text-amber-700",
  "Scheduled": "bg-[#fae008]/20 text-[#92400E]",
  "Completed": "bg-emerald-100 text-emerald-700"
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
  "Open": "bg-slate-100 text-slate-700",
  "Scheduled": "bg-[#FAE008] text-[#111827]",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-red-100 text-red-700"
};

export default function ProjectDetails({ project: initialProject, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [newDoor, setNewDoor] = useState({ height: "", width: "", type: "", style: "" });
  const [showAddDoor, setShowAddDoor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: project = initialProject } = useQuery({
    queryKey: ['project', initialProject.id],
    queryFn: () => base44.entities.Project.get(initialProject.id),
    initialData: initialProject
  });

  const [description, setDescription] = useState(project.description || "");
  const [notes, setNotes] = useState(project.notes || "");

  React.useEffect(() => {
    setDescription(project.description || "");
    setNotes(project.notes || "");
  }, [project.description, project.notes]);

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

  const { data: activeViewers = [] } = useQuery({
    queryKey: ['projectViewers', project.id],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        const viewers = await base44.entities.ProjectViewer.filter({ project_id: project.id });
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        return viewers.filter(v => v.last_seen > oneMinuteAgo && v.user_email !== user.email);
      } catch (error) {
        return [];
      }
    },
    refetchInterval: 10000
  });

  React.useEffect(() => {
    let viewerRecordId = null;
    const updatePresence = async () => {
      try {
        const user = await base44.auth.me();
        const viewerData = {
          project_id: project.id,
          user_email: user.email,
          user_name: user.full_name,
          last_seen: new Date().toISOString()
        };

        if (viewerRecordId) {
          try {
            await base44.entities.ProjectViewer.update(viewerRecordId, viewerData);
          } catch (error) {
            const newViewer = await base44.entities.ProjectViewer.create(viewerData);
            viewerRecordId = newViewer.id;
          }
        } else {
          const newViewer = await base44.entities.ProjectViewer.create(viewerData);
          viewerRecordId = newViewer.id;
        }
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000);

    return () => {
      clearInterval(interval);
      if (viewerRecordId) {
        base44.entities.ProjectViewer.delete(viewerRecordId).catch(() => {});
      }
    };
  }, [project.id]);

  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allProjects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
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

  const handleStageChange = async (newStage) => {
    const oldStage = project.status;
    
    // Save the stage change
    await handleFieldSave('status', oldStage, newStage);

    // Auto-create jobs based on stage
    const autoCreateJob = async (jobTypeName) => {
      // Check if job type already exists for this project
      const existingJob = jobs.find(j => j.job_type_name === jobTypeName);
      if (existingJob) {
        // Job already exists, navigate to it
        handleJobClick(existingJob.id);
        return;
      }

      // Fetch job types to get the ID
      const jobTypes = await base44.entities.JobType.list();
      const jobType = jobTypes.find(jt => jt.name === jobTypeName);
      
      // Get the latest job number
      const allJobs = await base44.entities.Job.list('-job_number', 1);
      const nextJobNumber = allJobs.length > 0 ? (allJobs[0].job_number || 5000) + 1 : 5000;

      // Build installation details text
      let installationDetails = '';
      if (project.doors && project.doors.length > 0) {
        installationDetails = '\n\n**Installation Details:**\n';
        project.doors.forEach((door, idx) => {
          installationDetails += `\nDoor ${idx + 1}:`;
          if (door.height && door.width) installationDetails += ` ${door.height} × ${door.width}`;
          if (door.type) installationDetails += ` • ${door.type}`;
          if (door.style) installationDetails += ` • ${door.style}`;
        });
      }

      // Map project type to product
      let product = null;
      if (project.project_type === "Garage Door Install") {
        product = "Garage Door";
      } else if (project.project_type === "Gate Install") {
        product = "Gate";
      } else if (project.project_type === "Roller Shutter Install") {
        product = "Roller Shutter";
      } else if (project.project_type === "Multiple") {
        product = "Multiple";
      }

      // Generate AI overview
      let additionalInfo = '';
      try {
        const prompt = `Based on this project information, create a concise bullet-point overview for this ${jobTypeName} job:

Project Title: ${project.title}
Project Type: ${project.project_type || 'N/A'}
Description: ${project.description || 'No description provided'}
${installationDetails}

Format as HTML bullet points using <ul> and <li> tags. Include only the most critical information the technician needs. Keep it brief - 3-5 bullet points maximum.`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          add_context_from_internet: false
        });

        // Strip markdown code fences if present
        additionalInfo = aiResponse.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
        
        // Add installation details if present
        if (installationDetails) {
          additionalInfo += `<br><br><strong>Installation Details:</strong><ul>`;
          project.doors.forEach((door, idx) => {
            let doorInfo = `Door ${idx + 1}:`;
            if (door.height && door.width) doorInfo += ` ${door.height} × ${door.width}`;
            if (door.type) doorInfo += ` • ${door.type}`;
            if (door.style) doorInfo += ` • ${door.style}`;
            additionalInfo += `<li>${doorInfo}</li>`;
          });
          additionalInfo += `</ul>`;
        }
      } catch (error) {
        // Fallback if AI fails
        additionalInfo = (project.description || '').replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
        if (installationDetails) {
          additionalInfo += `<br><br><strong>Installation Details:</strong><ul>`;
          project.doors.forEach((door, idx) => {
            let doorInfo = `Door ${idx + 1}:`;
            if (door.height && door.width) doorInfo += ` ${door.height} × ${door.width}`;
            if (door.type) doorInfo += ` • ${door.type}`;
            if (door.style) doorInfo += ` • ${door.style}`;
            additionalInfo += `<li>${doorInfo}</li>`;
          });
          additionalInfo += `</ul>`;
        }
      }

      // Create the job with project data
      const newJob = await base44.entities.Job.create({
        job_number: nextJobNumber,
        project_id: project.id,
        project_name: project.title,
        customer_id: project.customer_id,
        customer_name: project.customer_name,
        customer_phone: project.customer_phone,
        customer_email: project.customer_email,
        address: project.address,
        product: product,
        job_type_id: jobType?.id || null,
        job_type_name: jobTypeName,
        status: jobTypeName === "Installation" && newStage === "Scheduled" ? "Scheduled" : "Open",
        scheduled_date: new Date().toISOString().split('T')[0],
        additional_info: additionalInfo,
        image_urls: project.image_urls || [],
        quote_url: project.quote_url || null,
        invoice_url: project.invoice_url || null
      });

      // Log the auto-creation in change history
      const user = await base44.auth.me();
      await base44.entities.ChangeHistory.create({
        project_id: project.id,
        field_name: 'auto_created_job',
        old_value: '',
        new_value: `${jobTypeName} (Job #${nextJobNumber})`,
        changed_by: user.email,
        changed_by_name: user.full_name
      });

      // Refresh jobs and navigate to the new job
      queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      
      // Navigate to the new job
      setTimeout(() => {
        handleJobClick(newJob.id);
      }, 500);
    };

    // Stage-based automation
    if (newStage === "Initial Site Visit") {
      await autoCreateJob("Initial Site Visit");
    } else if (newStage === "Final Measure") {
      await autoCreateJob("Final Measure");
    } else if (newStage === "Scheduled") {
      await autoCreateJob("Installation");
    }
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
        const newImages = [...currentImages, file_url];
        updateProjectMutation.mutate({ 
          field: 'image_urls', 
          value: newImages 
        });

        // Create Photo record
        const user = await base44.auth.me();
        await base44.entities.Photo.create({
          image_url: file_url,
          project_id: project.id,
          project_name: project.title,
          customer_id: project.customer_id,
          customer_name: project.customer_name,
          address: project.address,
          uploaded_at: new Date().toISOString(),
          technician_email: user.email,
          technician_name: user.full_name
        });
        queryClient.invalidateQueries({ queryKey: ['photos'] });
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
    setSelectedImage(null);
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

  React.useEffect(() => {
    // Auto-focus tabs based on project stage
    if (project.status === "Completed") {
      setActiveTab("summary");
    } else if (project.status === "Lead" || project.status === "Initial Site Visit") {
      setActiveTab("overview");
    } else if (project.status === "Quote Sent" || project.status === "Quote Approved") {
      setActiveTab("quoting");
    } else if (project.status === "Parts Ordered") {
      setActiveTab("parts");
    } else if (project.status === "Scheduled") {
      setActiveTab("overview"); // Stay on overview but jobs list is visible in sidebar
    }
  }, [project.status]);

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 overflow-x-hidden">
      {/* Customer Sidebar */}
      <aside className="w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-4 lg:self-start">
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Customer</h3>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div 
              className="cursor-pointer hover:text-[#FAE008] transition-colors"
              onClick={handleCustomerClick}
            >
              <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">{project.customer_name}</h3>
            </div>

            {customer?.customer_type && (
              <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-medium px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                {customer.customer_type}
              </Badge>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-[#4B5563] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#6B7280] font-normal leading-[1.4] mb-0.5">Address</div>
                  <EditableField
                    value={project.address}
                    onSave={(val) => handleFieldSave('address', project.address, val)}
                    type="text"
                    placeholder="Set address"
                    className="text-[14px] font-normal text-[#111827] leading-[1.4]"
                  />
                </div>
              </div>

              {project.customer_phone && (
                <div className="flex items-start gap-2.5">
                  <a href={`tel:${project.customer_phone}`} className="hover:bg-[#F3F4F6] p-1 rounded transition-colors">
                    <Phone className="w-5 h-5 text-[#4B5563]" />
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[#6B7280] font-normal leading-[1.4] mb-0.5">Phone</div>
                    <span className="text-[14px] font-normal text-[#111827] leading-[1.4]">{project.customer_phone}</span>
                  </div>
                </div>
              )}

              {project.customer_email && (
                <div className="flex items-start gap-2.5">
                  <a href={`mailto:${project.customer_email}`} className="hover:bg-[#F3F4F6] p-1 rounded transition-colors">
                    <Mail className="w-5 h-5 text-[#4B5563]" />
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[#6B7280] font-normal leading-[1.4] mb-0.5">Email</div>
                    <span className="text-[14px] font-normal text-[#111827] leading-[1.4]">{project.customer_email}</span>
                  </div>
                </div>
              )}
            </div>
            </CardContent>
            </Card>

            {/* Visits Section */}
            <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden mt-4">
            <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Visits ({jobs.length})</h3>
              <Button
                onClick={handleAddJob}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            </CardHeader>
            <CardContent className="p-3">
            {jobs.length === 0 ? (
              <div className="text-center py-6 bg-[#F8F9FA] rounded-lg">
                <p className="text-[14px] text-[#6B7280] leading-[1.4] mb-3">No visits yet</p>
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

            {/* Images Section */}
            <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden mt-4">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Images</h3>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {project.image_urls && project.image_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {project.image_urls.slice(0, 4).map((url, index) => (
                      <div key={index} className="relative group">
                        <button
                          onClick={() => setSelectedImage({ url, index })}
                          className="block w-full"
                        >
                          <img 
                            src={url} 
                            alt={`Project image ${index + 1}`} 
                            className="w-full h-20 object-cover rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] transition-all cursor-pointer"
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {project.image_urls && project.image_urls.length > 4 && (
                  <div className="text-[12px] text-[#6B7280] text-center">
                    +{project.image_urls.length - 4} more images
                  </div>
                )}

                <label className="block">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 text-sm"
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

            {/* Documents Section */}
            <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden mt-4">
              <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">Documents</h3>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {project.quote_url && (
                  <button
                    onClick={() => setSelectedDocument({ url: project.quote_url, type: 'Quote' })}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-[#111827] truncate">Quote</span>
                  </button>
                )}
                {project.invoice_url && (
                  <button
                    onClick={() => setSelectedDocument({ url: project.invoice_url, type: 'Invoice' })}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-[#111827] truncate">Invoice</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="block">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        <FileText className="w-3 h-3 mr-1" />
                        Quote
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'quote')}
                    />
                  </label>
                  <label className="block">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        <FileText className="w-3 h-3 mr-1" />
                        Invoice
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
            </aside>

            {/* Main Content */}
            <div className="flex-1 w-full lg:min-w-0">
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
            {activeViewers.length > 0 && (
              <div className="flex -space-x-2 mr-2">
                {activeViewers.map((viewer, idx) => (
                  <div
                    key={viewer.id}
                    className="w-8 h-8 bg-[#FAE008] rounded-full flex items-center justify-center border-2 border-white"
                    title={viewer.user_name}
                  >
                    <span className="text-[#111827] font-semibold text-xs">
                      {viewer.user_name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
          {project.created_date && (
            <div className="text-[12px] text-[#6B7280] leading-[1.35]">
              Opened on {new Date(project.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} 
              {' '}({Math.floor((new Date() - new Date(project.created_date)) / (1000 * 60 * 60 * 24))} days)
            </div>
          )}

          <div className="bg-white p-3 rounded-lg border border-[#E5E7EB] overflow-hidden">
            <div className="text-[12px] font-medium text-[#4B5563] leading-[1.35] mb-2 uppercase tracking-wide">Project Stage</div>
            <ProjectStageSelector
              currentStage={project.status}
              onStageChange={handleStageChange}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              {project.title}
            </h2>
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
                  <Badge className={`${projectTypeColors[val]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                    {val}
                  </Badge>
                )}
              />
            )}
          </div>
          {project.financial_status && (
            <div className="mt-2">
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
                  <Badge className={`${financialStatusColors[val]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                    {val}
                  </Badge>
                )}
              />
            </div>
          )}
          </div>
        </CardHeader>

      <CardContent className="p-3 md:p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="visits" className="flex-1">
              Visits
            </TabsTrigger>
            <TabsTrigger value="quoting" className="flex-1">Quoting</TabsTrigger>
            <TabsTrigger value="parts" className="flex-1">Parts</TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="financials" className="flex-1">Financials</TabsTrigger>
            )}
            <TabsTrigger value="summary" className="flex-1">
              Summary
            </TabsTrigger>
            </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <div>
              <RichTextField
                label="Description"
                value={description}
                onChange={setDescription}
                onBlur={handleDescriptionBlur}
                placeholder="Add a clear summary of this project…"
              />
            </div>

            <div>
              <RichTextField
                label="Notes"
                value={notes}
                onChange={setNotes}
                onBlur={handleNotesBlur}
                placeholder="Add any extra notes or context for the team…"
                helperText="Internal only"
              />
            </div>

            {isInstallType && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
                    Measurements Provided
                  </label>
                  {!showAddDoor && (
                    <button
                      onClick={() => setShowAddDoor(true)}
                      className="w-8 h-8 bg-[#FAE008] hover:bg-[#E5CF07] rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4 text-[#111827]" />
                    </button>
                  )}
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-[#E5E7EB]">
                  {project.doors && project.doors.length > 0 ? (
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
                  ) : !showAddDoor && (
                    <p className="text-[14px] text-[#9CA3AF]">No doors added yet</p>
                  )}
                  
                  {showAddDoor && (
                    <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F8F9FA] mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <Input
                          placeholder="Height"
                          value={newDoor.height}
                          onChange={(e) => setNewDoor({ ...newDoor, height: e.target.value })}
                        />
                        <Input
                          placeholder="Width"
                          value={newDoor.width}
                          onChange={(e) => setNewDoor({ ...newDoor, width: e.target.value })}
                        />
                        <Input
                          placeholder="Type (e.g. Sectional, Roller)"
                          value={newDoor.type}
                          onChange={(e) => setNewDoor({ ...newDoor, type: e.target.value })}
                        />
                        <Input
                          placeholder="Style"
                          value={newDoor.style}
                          onChange={(e) => setNewDoor({ ...newDoor, style: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddDoor}
                          size="sm"
                          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Door
                        </Button>
                        <Button
                          onClick={() => setShowAddDoor(false)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="visits" className="mt-3">
            <ProjectVisitsTab projectId={project.id} isReadOnly={false} />
          </TabsContent>

          <TabsContent value="summary" className="mt-3">
            <ProjectSummary 
              project={project} 
              jobs={jobs}
              onUpdateNotes={(value) => updateProjectMutation.mutate({ field: 'notes', value })}
            />
          </TabsContent>

          {user?.role === 'admin' && (
            <TabsContent value="financials" className="mt-3">
              <FinancialsTab 
                project={project}
                onUpdate={(fields) => {
                  Object.entries(fields).forEach(([field, value]) => {
                    updateProjectMutation.mutate({ field, value });
                  });
                }}
              />
            </TabsContent>
          )}

          <TabsContent value="quoting" className="mt-3">
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Quote Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={project.quote_value || ""}
                    onChange={(e) => updateProjectMutation.mutate({ field: 'quote_value', value: parseFloat(e.target.value) || null })}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <RichTextField
                  label="Quote Products"
                  value={project.quote_products || ""}
                  onChange={(value) => updateProjectMutation.mutate({ field: 'quote_products', value })}
                  placeholder="List doors, products, and items included in the quote..."
                />
              </div>

              <div>
                <RichTextField
                  label="Quote Notes"
                  value={project.quote_notes || ""}
                  onChange={(value) => updateProjectMutation.mutate({ field: 'quote_notes', value })}
                  placeholder="Additional context, exclusions, special conditions..."
                  helperText="Terms, exclusions, payment terms, etc."
                />
              </div>

              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Quote Attachments
                </label>
                <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
                  <CardContent className="p-3 space-y-3">
                    {project.quote_attachments && project.quote_attachments.length > 0 && (
                      <div className="space-y-2">
                        {project.quote_attachments.map((url, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-[#F8F9FA] rounded-lg border border-[#E5E7EB]">
                            <FileText className="w-4 h-4 text-[#6B7280]" />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-[14px] text-[#111827] hover:underline truncate"
                            >
                              Quote Document {index + 1}
                            </a>
                            <button
                              onClick={() => {
                                const updatedAttachments = project.quote_attachments.filter((_, i) => i !== index);
                                updateProjectMutation.mutate({ field: 'quote_attachments', value: updatedAttachments });
                              }}
                              className="text-red-600 hover:bg-red-50 rounded p-1"
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
                          {uploading ? 'Uploading...' : 'Upload Quote Documents'}
                        </span>
                      </Button>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          if (files.length === 0) return;
                          setUploading(true);
                          try {
                            const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
                            const results = await Promise.all(uploadPromises);
                            const newUrls = results.map(r => r.file_url);
                            const currentAttachments = project.quote_attachments || [];
                            updateProjectMutation.mutate({ 
                              field: 'quote_attachments', 
                              value: [...currentAttachments, ...newUrls] 
                            });
                          } catch (error) {
                            console.error('Upload failed:', error);
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                    </label>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parts" className="mt-3">
            <PartsSection 
              projectId={project.id} 
              autoExpand={project.status === "Parts Ordered"} 
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <ProjectChangeHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        projectId={project.id}
      />
      </Card>
      </div>

      {selectedImage && (
        <PhotoModal
          imageUrl={selectedImage.url}
          onClose={() => setSelectedImage(null)}
          onDelete={() => handleRemoveImage(selectedImage.index)}
        />
      )}

      {selectedDocument && (
        <DocumentModal
          documentUrl={selectedDocument.url}
          documentType={selectedDocument.type}
          onClose={() => setSelectedDocument(null)}
          onDelete={
            selectedDocument.type === 'Quote'
              ? () => {
                  updateProjectMutation.mutate({ field: 'quote_url', value: null });
                  setSelectedDocument(null);
                }
              : () => {
                  updateProjectMutation.mutate({ field: 'invoice_url', value: null });
                  setSelectedDocument(null);
                }
          }
        />
      )}
    </div>
  );
}