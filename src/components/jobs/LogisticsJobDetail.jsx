import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Calendar, Clock, Truck, Package, CheckCircle2, Navigation, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import BackButton from "../common/BackButton";
import EditableField from "./EditableField";

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

  const handleComplete = () => {
    updateJobMutation.mutate({ 
      status: "Completed",
      outcome: outcome || "completed"
    });
    toast.success("Logistics job marked as completed");
  };

  const handleReschedule = () => {
    // Just navigate to schedule page with this job pre-selected
    window.location.href = `${window.location.origin}/Schedule?jobId=${job.id}`;
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
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Purchase Order</div>
                  <div className="font-medium text-slate-900">
                    {purchaseOrder.po_number || 'Draft'} • {purchaseOrder.supplier_name}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Order Items Section */}
            {poLines.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Order Items
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {poLines.map((line, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{line.description}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Qty: {line.qty_ordered} • ${line.unit_cost_ex_tax?.toFixed(2)} each
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">${line.total_line_ex_tax?.toFixed(2)}</div>
                        {line.qty_received > 0 && (
                          <Badge variant="outline" className="text-[10px] mt-1 bg-green-50 text-green-700 border-green-200">
                            {line.qty_received}/{line.qty_ordered} received
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Parts from Project */}
            {linkedParts.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Project Parts
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {linkedParts.map((part) => (
                    <div key={part.id} className="p-3">
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
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add pickup/delivery notes..."
                className="min-h-[100px]"
              />
            </div>

            {/* Attachments from PO/Parts */}
            {(purchaseOrder?.attachments?.length > 0 || linkedParts.some(p => p.attachments?.length > 0)) && (
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Attachments</h3>
                <div className="space-y-2">
                  {purchaseOrder?.attachments?.map((url, idx) => (
                    <a 
                      key={idx} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      PO Attachment {idx + 1}
                    </a>
                  ))}
                  {linkedParts.flatMap(p => p.attachments || []).map((url, idx) => (
                    <a 
                      key={idx} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Part Attachment {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {job.status !== "Completed" && job.status !== "Cancelled" && (
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Outcome (optional)</label>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed Successfully</SelectItem>
                      <SelectItem value="partial">Partially Completed</SelectItem>
                      <SelectItem value="issue">Issue Encountered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReschedule}
                    className="font-medium"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={updateJobMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {updateJobMutation.isPending ? 'Completing...' : 'Mark Complete'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}