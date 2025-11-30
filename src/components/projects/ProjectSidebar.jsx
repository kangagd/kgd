import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MapPin, Briefcase, MessageCircle, Image as ImageIcon, FileText, Plus, ExternalLink, Trash2, Upload } from "lucide-react";
import CustomerQuickEdit from "./CustomerQuickEdit";
import AddressAutocomplete from "../common/AddressAutocomplete";
import TasksPanel from "../tasks/TasksPanel";
import ProjectChat from "./ProjectChat";
import JobCard from "../jobs/JobCard";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ProjectSidebar({ project, jobs, onClose, onEdit, onDelete, canEdit, canDelete }) {
  const queryClient = useQueryClient();
  const tasksPanelRef = useRef(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    }
  });

  const handleMediaUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
        const newUrls = [];
        for (let i = 0; i < files.length; i++) {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: files[i] });
            newUrls.push(file_url);
        }
        const currentImages = project.image_urls || [];
        updateProjectMutation.mutate({ image_urls: [...currentImages, ...newUrls] });
        toast.success("Media uploaded");
    } catch (error) {
        console.error(error);
        toast.error("Failed to upload media");
    } finally {
        setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = (index) => {
      if(!confirm("Remove this image?")) return;
      const currentImages = [...(project.image_urls || [])];
      currentImages.splice(index, 1);
      updateProjectMutation.mutate({ image_urls: currentImages });
  };

  // Documents (using other_documents field for now, assuming it stores URLs)
  // If schema doesn't allow easy document management, we'll reuse image_urls or just mock for now if needed.
  // But prompt says "List any files or links already associated... Use existing storage mechanism".
  // Project entity has `other_documents` (array of strings).
  const handleDocumentUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
        const newDocs = [];
        for (let i = 0; i < files.length; i++) {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: files[i] });
            newDocs.push(file_url);
        }
        const currentDocs = project.other_documents || [];
        updateProjectMutation.mutate({ other_documents: [...currentDocs, ...newDocs] });
        toast.success("Documents uploaded");
    } catch (error) {
        console.error(error);
        toast.error("Failed to upload document");
    }
  };

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-4 space-y-4">
      {/* Customer Card */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[16px] font-semibold text-[#111827]">Customer</h3>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <CustomerQuickEdit
            customerId={project.customer_id}
            projectId={project.id}
            onCustomerUpdate={() => queryClient.invalidateQueries({ queryKey: ['project', project.id] })}
          />
          <div className="pt-3 border-t border-[#E5E7EB]">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-[#6B7280] font-normal mb-0.5">Address</div>
                <AddressAutocomplete
                  value={project.address_full || project.address}
                  onChange={(addressData) => {
                    updateProjectMutation.mutate({
                      address: addressData.address_full,
                      address_full: addressData.address_full,
                      address_street: addressData.address_street,
                      address_suburb: addressData.address_suburb,
                      address_state: addressData.address_state,
                      address_postcode: addressData.address_postcode,
                      address_country: addressData.address_country,
                      latitude: addressData.latitude,
                      longitude: addressData.longitude,
                      google_place_id: addressData.google_place_id
                    });
                  }}
                  placeholder="Search address..."
                  className="text-[14px]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Collapsible defaultOpen={true}>
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                <h3 className="text-[16px] font-semibold text-[#111827]">Tasks</h3>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (tasksPanelRef.current) {
                            tasksPanelRef.current.openCreateModal();
                        }
                    }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
                <CollapsibleTrigger>
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3">
              <TasksPanel
                ref={tasksPanelRef}
                entityType="project"
                entityId={project.id}
                entityName={project.title}
                compact={true}
                hideHeader={true}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Project Chat */}
      <Collapsible defaultOpen={false}>
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-[16px] font-semibold text-[#111827]">Project Chat</h3>
              </div>
              <ChevronDown className="w-4 h-4 text-[#6B7280]" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="h-80">
                <ProjectChat projectId={project.id} />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Visits */}
      <Collapsible defaultOpen={true}>
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                <Briefcase className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-[16px] font-semibold text-[#111827]">Visits ({jobs.length})</h3>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
                <Button 
                    onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `${createPageUrl("Jobs")}?action=new&projectId=${project.id}`;
                    }}
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
                <CollapsibleTrigger>
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3">
              <div className="grid gap-2">
                {jobs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">No visits yet</p>
                ) : (
                    jobs.slice(0, 5).map(job => (
                        <JobCard 
                            key={job.id} 
                            job={job} 
                            onClick={() => window.location.href = `${createPageUrl("Jobs")}?jobId=${job.id}`} 
                            compact={true} 
                        />
                    ))
                )}
                {jobs.length > 5 && (
                    <Button variant="link" className="text-xs p-0" onClick={() => window.location.href = `${createPageUrl("Jobs")}?projectId=${project.id}`}>
                        View all {jobs.length} visits
                    </Button>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Media */}
      <Collapsible defaultOpen={false}>
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                <ImageIcon className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-[16px] font-semibold text-[#111827]">Media</h3>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
                <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        disabled={uploadingMedia} 
                        asChild
                    >
                        <span>
                            <Plus className="w-3 h-3 mr-1" /> {uploadingMedia ? "..." : "Add"}
                        </span>
                    </Button>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleMediaUpload} />
                </label>
                <CollapsibleTrigger>
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {(project.image_urls || []).slice(0, 9).map((url, i) => (
                    <div key={i} className="relative aspect-square group">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-md border border-slate-200" />
                        {canEdit && (
                            <button 
                                onClick={() => handleDeleteMedia(i)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                        <button 
                            onClick={() => window.open(url, '_blank')}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <ExternalLink className="w-4 h-4 text-white" />
                        </button>
                    </div>
                ))}
                {(project.image_urls || []).length === 0 && (
                    <p className="col-span-3 text-xs text-slate-500 text-center py-2">No media uploaded</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Documents */}
      <Collapsible defaultOpen={false}>
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                <FileText className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-[16px] font-semibold text-[#111827]">Documents</h3>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
                <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        asChild
                    >
                        <span>
                            <Plus className="w-3 h-3 mr-1" /> Add
                        </span>
                    </Button>
                    <input type="file" multiple className="hidden" onChange={handleDocumentUpload} />
                </label>
                <CollapsibleTrigger>
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3">
              <div className="space-y-2">
                {(project.other_documents || []).map((doc, i) => {
                    const name = doc.split('/').pop();
                    return (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm border border-slate-100">
                            <a href={doc} target="_blank" rel="noreferrer" className="truncate flex-1 hover:underline text-blue-600 flex items-center gap-2">
                                <FileText className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{name}</span>
                            </a>
                        </div>
                    );
                })}
                {(project.other_documents || []).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-2">No documents</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </aside>
  );
}