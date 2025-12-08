import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MapPin, Calendar, Clock, Truck, Package, CheckCircle2, Navigation, Trash2, FileText, ExternalLink, FolderKanban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import BackButton from "../common/BackButton";
import EditableField from "./EditableField";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

  const isPickup = job.job_type_name?.toLowerCase().includes('pickup');
  const isDelivery = job.job_type_name?.toLowerCase().includes('delivery');

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="border-b border-[#E5E7EB] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BackButton onClick={onClose} />
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <h1 className="text-xl font-bold text-[#111827]">Logistics Job #{job.job_number}</h1>
                </div>
              </div>
              <Badge className={`${statusColors[job.status]} border text-xs font-semibold px-3 py-1`}>
                {job.status}
              </Badge>
            </div>

            {/* Job Info */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-900">{job.job_type_name}</span>
              </div>

              {job.project_id && project && (
                <Link to={`${createPageUrl("Projects")}?projectId=${job.project_id}`}>
                  <div className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors">
                    <FolderKanban className="w-4 h-4" />
                    <span className="text-sm font-medium">{project.title}</span>
                  </div>
                </Link>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">
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

                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Scheduled</div>
                    <EditableField
                      value={job.scheduled_date}
                      onSave={(val) => updateJobMutation.mutate({ scheduled_date: val })}
                      type="date"
                      displayFormat={(val) => format(parseISO(val), 'MMM d, yyyy')}
                      placeholder="Set date"
                      className="text-sm font-medium text-slate-900"
                    />
                    {job.scheduled_time && (
                      <div className="text-sm text-slate-600 mt-0.5">{job.scheduled_time}</div>
                    )}
                  </div>
                </div>
              </div>

              {purchaseOrder && (
                <div className="pt-3 border-t border-slate-200 space-y-1">
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
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* SECTION 2: Order Items Checklist */}
            {(poLines.length > 0 || linkedParts.length > 0) && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Items Checklist
                  </h3>
                </div>
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
                          <div className="text-xs text-slate-500 mt-0.5">
                            Qty: {line.qty_ordered} • ${line.unit_cost_ex_tax?.toFixed(2)} each
                          </div>
                          {line.qty_received > 0 && (
                            <Badge variant="outline" className="text-[10px] mt-1 bg-green-50 text-green-700 border-green-200">
                              {line.qty_received}/{line.qty_ordered} received
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">${line.total_line_ex_tax?.toFixed(2)}</div>
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
              </div>
            )}

            {/* SECTION 3: Notes */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Notes</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Job Notes</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Add pickup/delivery notes..."
                    className="min-h-[80px]"
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
              </div>
            </div>

            {/* SECTION 4: Attachments */}
            {(purchaseOrder?.attachments?.length > 0 || linkedParts.some(p => p.attachments?.length > 0) || job.other_documents?.length > 0) && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Attachments
                  </h3>
                </div>
                <div className="p-4 space-y-2">
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
              </div>
            )}

            {/* SECTION 5: Outcome */}
            {job.status !== "Completed" && job.status !== "Cancelled" && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Outcome</h3>
                </div>
                <div className="p-4 space-y-3">
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
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {updateJobMutation.isPending ? 'Completing...' : 'Mark Complete'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Mark complete when all items have been picked up or delivered
                  </p>
                </div>
              </div>
            )}

            {job.status === "Completed" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Logistics job completed</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}