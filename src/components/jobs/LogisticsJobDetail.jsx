import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MapPin, Calendar, Clock, Truck, Package, CheckCircle2, Navigation, Trash2, FileText, ExternalLink, FolderKanban, User, Image as ImageIcon, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import BackButton from "../common/BackButton";
import EditableField from "./EditableField";
import EditableFileUpload from "./EditableFileUpload";
import JobChat from "./JobChat";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TechnicianAvatar, { TechnicianAvatarGroup } from "../common/TechnicianAvatar";

const statusColors = {
  "Open": "bg-slate-100 text-slate-700 border-slate-200",
  "Scheduled": "bg-blue-100 text-blue-700 border-blue-200",
  "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-700 border-red-200"
};

export default function LogisticsJobDetail({ job: initialJob, onClose }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState(initialJob.notes || "");
  const [outcome, setOutcome] = useState("");

  const { data: job = initialJob } = useQuery({
    queryKey: ['job', initialJob.id],
    queryFn: () => base44.entities.Job.get(initialJob.id),
    initialData: initialJob
  });

  // Fetch PO and lines
  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-order', job.purchase_order_id],
    queryFn: () => base44.entities.PurchaseOrder.get(job.purchase_order_id),
    enabled: !!job.purchase_order_id
  });

  const { data: poLines = [] } = useQuery({
    queryKey: ['po-lines', job.purchase_order_id],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ purchase_order_id: job.purchase_order_id }),
    enabled: !!job.purchase_order_id
  });

  // Fetch linked parts
  const { data: linkedParts = [] } = useQuery({
    queryKey: ['parts-for-logistics-job', job.id],
    queryFn: async () => {
      const allParts = await base44.entities.Part.list();
      return allParts.filter(p => 
        p.linked_logistics_jobs?.includes(job.id)
      );
    }
  });

  // Fetch supplier
  const { data: supplier } = useQuery({
    queryKey: ['supplier', purchaseOrder?.supplier_id],
    queryFn: () => base44.entities.Supplier.get(purchaseOrder.supplier_id),
    enabled: !!purchaseOrder?.supplier_id
  });

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ['project', job.project_id],
    queryFn: () => base44.entities.Project.get(job.project_id),
    enabled: !!job.project_id
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: !!(user?.role === 'admin' || user?.role === 'manager')
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const updateJobMutation = useMutation({
    mutationFn: async (updates) => {
      const res = await base44.functions.invoke('manageJob', { 
        action: 'update', 
        id: job.id, 
        data: updates 
      });
      return res.data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const handleNotesBlur = () => {
    if (notes !== job.notes) {
      updateJobMutation.mutate({ notes });
    }
  };

  const togglePOLineMutation = useMutation({
    mutationFn: async ({ lineId, isDone }) => {
      const line = poLines.find(l => l.id === lineId);
      await base44.entities.PurchaseOrderLine.update(lineId, {
        qty_received: isDone ? line.qty_ordered : 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-lines'] });
      toast.success("Item updated");
    }
  });

  const togglePartMutation = useMutation({
    mutationFn: async ({ partId, isDone }) => {
      const newStatus = isDone ? "Delivered" : "Ordered";
      const newLocation = isDone ? "At Delivery Bay" : "At Supplier";
      await base44.entities.Part.update(partId, {
        status: newStatus,
        location: newLocation
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-for-logistics-job'] });
      toast.success("Part updated");
    }
  });

  const handleComplete = () => {
    updateJobMutation.mutate({ 
      status: "Completed",
      outcome: outcome || "completed"
    });
    toast.success("Logistics job marked as completed");
  };

  const handleReschedule = () => {
    updateJobMutation.mutate({ 
      status: "Open"
    });
    toast.info("Job status changed to Open for rescheduling");
  };

  const handleAssignedToChange = (emails) => {
    const newAssignedEmails = Array.isArray(emails) ? emails : emails ? [emails] : [];
    const techNames = newAssignedEmails.map((email) => {
      const tech = technicians.find((t) => t.email === email);
      return tech?.display_name || tech?.full_name;
    }).filter(Boolean);
    
    updateJobMutation.mutate({
      assigned_to: newAssignedEmails,
      assigned_to_name: techNames
    });
  };

  const handleImagesChange = async (urls) => {
    updateJobMutation.mutate({ image_urls: urls });
    
    // Create Photo records for new images
    const existingUrls = job.image_urls || [];
    const newUrls = Array.isArray(urls) ? urls.filter(url => !existingUrls.includes(url)) : [];
    
    if (newUrls.length > 0 && user) {
      for (const url of newUrls) {
        try {
          await base44.entities.Photo.create({
            image_url: url,
            job_id: job.id,
            job_number: job.job_number,
            uploaded_at: new Date().toISOString(),
            technician_email: user.email,
            technician_name: user.full_name
          });
        } catch (error) {
          console.error('Failed to create photo record:', error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    }
  };

  const isPickup = job.job_type_name?.toLowerCase().includes('pickup');
  const isDelivery = job.job_type_name?.toLowerCase().includes('delivery');

  return (
    <div className="bg-[#ffffff] min-h-screen">
      <div className="mx-auto p-5 md:p-10 max-w-6xl">
        <div className="flex items-center gap-3 mb-4">
          <BackButton onClick={onClose} />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Job #{job.job_number}</h1>
              <p className="text-sm text-[#6B7280]">{job.job_type_name}</p>
            </div>
          </div>
          <Badge className={`${statusColors[job.status]} border text-xs font-semibold px-3 py-1`}>
            {job.status}
          </Badge>
        </div>

        <Card className="border border-[#E5E7EB] shadow-sm mb-6">
          <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
            <CardTitle className="text-lg font-bold text-[#111827]">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {job.project_id && project && (
                <div>
                  <label className="text-sm font-medium text-[#6B7280]">Project</label>
                  <Link to={`${createPageUrl("Projects")}?projectId=${job.project_id}`}>
                    <div className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors mt-1">
                      <FolderKanban className="w-4 h-4" />
                      <span className="text-sm font-medium">{project.title}</span>
                    </div>
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#6B7280]">
                    {isPickup ? 'Pickup From' : 'Deliver To'}
                  </label>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                    className="text-sm text-[#111827] hover:text-blue-600 transition-colors text-left mt-1 flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {job.address_full || job.address}
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#6B7280]">Scheduled</label>
                  <div className="mt-1">
                    <EditableField
                      value={job.scheduled_date}
                      onSave={(val) => updateJobMutation.mutate({ scheduled_date: val })}
                      type="date"
                      displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                      placeholder="Set date"
                      className="text-sm font-medium text-[#111827]"
                    />
                    {job.scheduled_time && (
                      <div className="text-sm text-[#6B7280] mt-1">{job.scheduled_time}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#6B7280]">Assigned To</label>
                  <div className="mt-1">
                    <EditableField
                      value={Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : []}
                      onSave={handleAssignedToChange}
                      type="multi-select"
                      options={technicians.map((t) => ({ value: t.email, label: t.display_name || t.full_name }))}
                      displayFormat={(val) => {
                        const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                        const namesToDisplay = Array.isArray(job.assigned_to_name) ? job.assigned_to_name : job.assigned_to_name ? [job.assigned_to_name] : [];

                        if (namesToDisplay.length === 0) {
                          return (
                            <TechnicianAvatar
                              technician={{ email: '', full_name: 'Unassigned', id: 'unassigned' }}
                              size="sm"
                              showPlaceholder={true}
                            />
                          );
                        }

                        return (
                          <TechnicianAvatarGroup
                            technicians={emailsToDisplay.map((email, idx) => ({
                              email,
                              display_name: namesToDisplay[idx] || email,
                              full_name: namesToDisplay[idx] || email,
                              id: email
                            }))}
                            maxDisplay={3}
                            size="sm"
                          />
                        );
                      }}
                      placeholder="Assign"
                    />
                  </div>
                </div>

                {purchaseOrder && (
                  <div>
                    <label className="text-sm font-medium text-[#6B7280]">Purchase Order</label>
                    <div className="mt-1">
                      <div className="text-sm font-medium text-[#111827]">
                        {purchaseOrder.po_number || 'Draft'} • {purchaseOrder.supplier_name}
                      </div>
                      {purchaseOrder.expected_date && (
                        <div className="text-xs text-[#6B7280] mt-1">
                          Expected: {format(new Date(purchaseOrder.expected_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          {/* Order Items Checklist */}
          {(poLines.length > 0 || linkedParts.length > 0) && (
            <Card className="border border-[#E5E7EB] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
                <CardTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Items Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-200">
                  {/* PO Lines */}
                  {poLines.map((line) => {
                    const isDone = line.qty_received >= line.qty_ordered;
                    return (
                      <div key={line.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={(checked) => togglePOLineMutation.mutate({ lineId: line.id, isDone: !!checked })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{line.item_name || line.description}</div>
                          {line.qty_received > 0 && (
                            <Badge variant="outline" className="text-[10px] mt-1 bg-green-50 text-green-700 border-green-200">
                              {line.qty_received}/{line.qty_ordered} received
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Linked Parts */}
                  {linkedParts.map((part) => {
                    const isDone = part.status === "Delivered";
                    return (
                      <div key={part.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={(checked) => togglePartMutation.mutate({ partId: part.id, isDone: !!checked })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{part.category}</div>
                          {part.notes && (
                            <div className="text-sm text-slate-600 mt-1">{part.notes}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {part.status}
                            </Badge>
                            {part.supplier_name && (
                              <span className="text-xs text-slate-500">{part.supplier_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          <Card className="border border-[#E5E7EB] shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
              <CardTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <EditableFileUpload
                files={job.image_urls || []}
                onFilesChange={handleImagesChange}
                accept="image/*,video/*"
                multiple={true}
                icon={ImageIcon}
                label=""
                emptyText="Upload photos"
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="border border-[#E5E7EB] shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
              <CardTitle className="text-lg font-bold text-[#111827]">Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#6B7280] mb-2">Job Notes</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Add pickup/delivery notes..."
                    className="min-h-[100px]"
                  />
                </div>

                {purchaseOrder?.notes && (
                  <div className="pt-4 border-t border-[#E5E7EB]">
                    <div className="text-sm font-medium text-[#6B7280] mb-2">Purchase Order Notes</div>
                    <div className="text-sm text-[#111827] bg-[#F9FAFB] p-3 rounded-lg">{purchaseOrder.notes}</div>
                  </div>
                )}

                {linkedParts.some(p => p.notes) && (
                  <div className="pt-4 border-t border-[#E5E7EB]">
                    <div className="text-sm font-medium text-[#6B7280] mb-2">Part Notes</div>
                    <div className="space-y-2">
                      {linkedParts.filter(p => p.notes).map((part) => (
                        <div key={part.id} className="text-sm text-[#111827] bg-[#F9FAFB] p-3 rounded-lg">
                          <span className="font-medium">{part.category}:</span> {part.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Chat */}
          <Card className="border border-[#E5E7EB] shadow-sm">
            <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
              <CardTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Team Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <JobChat jobId={job.id} />
            </CardContent>
          </Card>

          {/* Attachments */}
          {(purchaseOrder?.attachments?.length > 0 || linkedParts.some(p => p.attachments?.length > 0) || job.other_documents?.length > 0) && (
            <Card className="border border-[#E5E7EB] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
                <CardTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  {purchaseOrder?.attachments?.map((url, idx) => (
                    <Button
                      key={`po-${idx}`}
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(url, '_blank')}
                      className="w-full justify-between"
                    >
                      <span className="text-sm">PO Attachment {idx + 1}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  ))}
                  {linkedParts.flatMap((part, partIdx) => 
                    (part.attachments || []).map((url, idx) => (
                      <Button
                        key={`part-${partIdx}-${idx}`}
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(url, '_blank')}
                        className="w-full justify-between"
                      >
                        <span className="text-sm">{part.category} Attachment {idx + 1}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    ))
                  )}
                  {job.other_documents?.map((url, idx) => (
                    <Button
                      key={`job-${idx}`}
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(url, '_blank')}
                      className="w-full justify-between"
                    >
                      <span className="text-sm">Job Document {idx + 1}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Outcome Actions */}
          {job.status !== "Completed" && job.status !== "Cancelled" && (
            <Card className="border border-[#E5E7EB] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
                <CardTitle className="text-lg font-bold text-[#111827]">Complete Job</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReschedule}
                    disabled={updateJobMutation.isPending}
                    className="font-medium h-11"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={updateJobMutation.isPending}
                    className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-11"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {updateJobMutation.isPending ? 'Completing...' : 'Mark Complete'}
                  </Button>
                </div>
                <p className="text-xs text-[#6B7280] text-center">
                  Mark complete when all items have been picked up or delivered
                </p>
              </CardContent>
            </Card>
          )}

          {job.status === "Completed" && (
            <Card className="border border-[#16A34A] bg-[#F0FDF4]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-[#16A34A]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Logistics job completed</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}