import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, MapPin, Phone, Calendar, Clock, Truck, Package, 
  CheckCircle2, Navigation, FileText, ExternalLink, FolderKanban, 
  User, Image as ImageIcon, MessageCircle, ChevronDown, Map as MapIcon,
  DollarSign, FileCheck, LogIn, LogOut as LogOutIcon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import BackButton from "../common/BackButton";
import EditableField from "./EditableField";
import EditableFileUpload from "./EditableFileUpload";
import JobChat from "./JobChat";
import RichTextEditor from "../common/RichTextEditor";
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
  const [activeTab, setActiveTab] = useState("details");

  const { data: job = initialJob } = useQuery({
    queryKey: ['job', initialJob.id],
    queryFn: () => base44.entities.Job.get(initialJob.id),
    initialData: initialJob
  });

  // Fetch check-in data
  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkIns', job.id],
    queryFn: () => base44.entities.CheckInOut.filter({ job_id: job.id }),
    refetchInterval: 5000
  });

  const activeCheckIn = checkIns.find(c => !c.check_out_time);

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

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('performCheckIn', {
        job_id: job.id
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns'] });
      toast.success("Checked in successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to check in");
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('performCheckOut', {
        check_in_id: activeCheckIn.id
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkIns'] });
      toast.success("Checked out successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to check out");
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
  const customerName = purchaseOrder?.supplier_name || project?.customer_name || "Logistics Job";
  const customerPhone = supplier?.phone || project?.customer_phone || null;

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <BackButton onClick={onClose} />
            <span className="text-sm text-slate-500">
              {job.scheduled_date && job.scheduled_time && (
                <>Scheduled for {format(parseISO(job.scheduled_date), 'EEEE, MMM d, yyyy')} at {job.scheduled_time}</>
              )}
              {job.scheduled_date && !job.scheduled_time && (
                <>Scheduled for {format(parseISO(job.scheduled_date), 'EEEE, MMM d, yyyy')}</>
              )}
              {job.expected_duration && <> for {job.expected_duration}h</>}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <h1 className="text-3xl font-bold text-[#111827]">{customerName}</h1>
              <Badge variant="secondary" className="text-sm">#{job.job_number}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {job.job_type_name && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
                  {job.job_type_name}
                </Badge>
              )}
              <Badge className={`${statusColors[job.status]} border px-3 py-1`}>
                {job.status}
              </Badge>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex items-start gap-3">
              <Navigation className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">
                  {isPickup ? 'Pickup From' : 'Deliver To'}
                </div>
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank')}
                  className="text-sm text-slate-900 hover:text-green-600 transition-colors text-left"
                >
                  {job.address_full || job.address}
                </button>
              </div>
            </div>

            {customerPhone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Phone</div>
                  <a href={`tel:${customerPhone}`} className="text-sm text-slate-900 hover:text-blue-600">
                    {customerPhone}
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Assigned</div>
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
                          size="md"
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
                        size="md"
                      />
                    );
                  }}
                  placeholder="Assign"
                />
              </div>
            </div>
          </div>

          {/* Schedule Collapsible */}
          <Collapsible defaultOpen className="border border-slate-200 rounded-lg mb-6">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
              <span className="font-medium text-slate-900">Schedule</span>
              <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-slate-200 p-4">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase mb-2">Visit 1</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Date</div>
                        <EditableField
                          value={job.scheduled_date}
                          onSave={(val) => updateJobMutation.mutate({ scheduled_date: val })}
                          type="date"
                          displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                          placeholder="Set date"
                          className="text-sm font-medium text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Time</div>
                        <EditableField
                          value={job.scheduled_time}
                          onSave={(val) => updateJobMutation.mutate({ scheduled_time: val })}
                          type="text"
                          placeholder="Set time"
                          className="text-sm font-medium text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">Duration (hours)</div>
                        <EditableField
                          value={job.expected_duration}
                          onSave={(val) => updateJobMutation.mutate({ expected_duration: parseFloat(val) })}
                          type="number"
                          placeholder="1"
                          className="text-sm font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Check In/Out Section */}
                <div className="pt-4 border-t border-slate-200">
                  {activeCheckIn ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">Checked in at {format(new Date(activeCheckIn.check_in_time), 'h:mm a')}</span>
                      </div>
                      <Button
                        onClick={() => checkOutMutation.mutate()}
                        disabled={checkOutMutation.isPending}
                        className="w-full bg-slate-600 hover:bg-slate-700"
                      >
                        <LogOutIcon className="w-4 h-4 mr-2" />
                        {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => checkInMutation.mutate()}
                      disabled={checkInMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                    </Button>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto mb-6">
            <TabsTrigger value="details" className="gap-2">
              <FileCheck className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <MapIcon className="w-4 h-4" />
              Map
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {/* Items Checklist */}
            {(poLines.length > 0 || linkedParts.length > 0) && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  <span className="font-medium text-slate-900">Items</span>
                  <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Job Info */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                <span className="font-medium text-slate-900">Job Info</span>
                <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Card className="border border-slate-200">
                  <CardContent className="p-4 space-y-4">
                    {job.project_id && project && (
                      <Link to={`${createPageUrl("Projects")}?projectId=${job.project_id}`}>
                        <div className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors">
                          <FolderKanban className="w-4 h-4" />
                          <span className="text-sm font-medium">{project.title}</span>
                        </div>
                      </Link>
                    )}

                    {purchaseOrder && (
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">Purchase Order</div>
                        <div className="font-medium text-slate-900">
                          {purchaseOrder.po_number || 'Draft'} • {purchaseOrder.supplier_name}
                        </div>
                        {purchaseOrder.expected_date && (
                          <div className="text-xs text-slate-600">
                            Expected: {format(new Date(purchaseOrder.expected_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                      <RichTextEditor
                        value={notes}
                        onChange={setNotes}
                        onBlur={handleNotesBlur}
                        placeholder="Add pickup/delivery notes..."
                      />
                    </div>

                    {purchaseOrder?.notes && (
                      <div className="pt-3 border-t border-slate-200">
                        <div className="text-xs font-medium text-slate-500 mb-1">Purchase Order Notes:</div>
                        <div className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{purchaseOrder.notes}</div>
                      </div>
                    )}

                    {linkedParts.some(p => p.notes) && (
                      <div className="pt-3 border-t border-slate-200">
                        <div className="text-xs font-medium text-slate-500 mb-2">Part Notes:</div>
                        <div className="space-y-2">
                          {linkedParts.filter(p => p.notes).map((part) => (
                            <div key={part.id} className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
                              <span className="font-medium">{part.category}:</span> {part.notes}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-4">
            <Card className="border border-slate-200">
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Photos & Videos</h3>
              </CardHeader>
              <CardContent>
                <EditableFileUpload
                  files={job.image_urls || []}
                  onFilesChange={handleImagesChange}
                  accept="image/*,video/*"
                  multiple={true}
                  icon={ImageIcon}
                  label=""
                  emptyText="Upload photos or videos"
                />
              </CardContent>
            </Card>

            {/* Attachments */}
            {(purchaseOrder?.attachments?.length > 0 || linkedParts.some(p => p.attachments?.length > 0) || job.other_documents?.length > 0) && (
              <Card className="border border-slate-200">
                <CardHeader>
                  <h3 className="font-semibold text-slate-900">Documents</h3>
                </CardHeader>
                <CardContent className="space-y-2">
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card className="border border-slate-200">
              <CardContent className="p-4">
                <JobChat jobId={job.id} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map">
            <Card className="border border-slate-200">
              <CardContent className="p-0">
                <div className="aspect-video w-full">
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(job.address_full || job.address)}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Complete/Reschedule Actions */}
        {job.status !== "Completed" && job.status !== "Cancelled" && (
          <Card className="border border-slate-200 mt-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => updateJobMutation.mutate({ status: "Open" })}
                  disabled={updateJobMutation.isPending}
                  className="font-medium h-11"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Reschedule
                </Button>
                <Button
                  onClick={() => updateJobMutation.mutate({ status: "Completed", outcome: "completed" })}
                  disabled={updateJobMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {updateJobMutation.isPending ? 'Completing...' : 'Mark Complete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {job.status === "Completed" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Logistics job completed</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}