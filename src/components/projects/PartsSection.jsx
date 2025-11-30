import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Link as LinkIcon, MapPin, Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PartDetailModal from "./PartDetailModal";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";

const statusColors = {
  "Pending": "bg-slate-100 text-slate-800 border-slate-200",
  "Ordered": "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Returned": "bg-orange-100 text-orange-800 border-orange-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const locationColors = {
  "On Order": "bg-slate-50 text-slate-600",
  "At Supplier": "bg-indigo-50 text-indigo-600",
  "At Delivery Bay": "bg-blue-50 text-blue-600",
  "In Warehouse Storage": "bg-purple-50 text-purple-600",
  "With Technician": "bg-amber-50 text-amber-600",
  "At Client Site": "bg-green-50 text-green-600"
};

// Flow steps for progress bar
const FLOW_STEPS = ["On Order", "At Delivery Bay", "In Warehouse Storage", "With Technician", "At Client Site"];

export default function PartsSection({ projectId, autoExpand = false }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const queryClient = useQueryClient();

  const { data: parts = [] } = useQuery({
    queryKey: ['parts', projectId],
    queryFn: () => base44.entities.Part.filter({ project_id: projectId }, '-order_date')
  });

  const createPartMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('managePart', { action: 'create', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false);
      setEditingPart(null);
      toast.success("Part added successfully");
    }
  });

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('managePart', { action: 'update', id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false);
      setEditingPart(null);
      toast.success("Part updated");
    }
  });

  const deletePartMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('managePart', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false); 
      toast.success("Part deleted");
    }
  });

  useEffect(() => {
    if (autoExpand && parts.length === 0) {
      handleAddPart();
    }
  }, [autoExpand, parts.length, projectId]);

  const handleAddPart = () => {
    setEditingPart(null); // null indicates new
    setShowModal(true);
  };

  const handleEditPart = (part) => {
    setEditingPart(part);
    setShowModal(true);
  };

  const handleSave = (data) => {
    if (editingPart?.id) {
      updatePartMutation.mutate({ id: editingPart.id, data });
    } else {
      createPartMutation.mutate({ ...data, project_id: projectId });
    }
  };

  const handleCreateLogisticsJob = (part) => {
      // Pre-fill job creation with logistics type
      window.location.href = `/jobs?action=create&projectId=${projectId}&partId=${part.id}&jobCategory=Logistics`;
  };

  // Quick Action: Mark Delivered
  const markDelivered = (e, part) => {
    e.stopPropagation();
    updatePartMutation.mutate({ 
      id: part.id, 
      data: { 
        status: "Delivered", 
        location: "At Delivery Bay" 
      } 
    });
  };

  // Quick Action: Update Location
  const advanceLocation = (e, part) => {
    e.stopPropagation();
    const currentIndex = FLOW_STEPS.indexOf(part.location);
    if (currentIndex !== -1 && currentIndex < FLOW_STEPS.length - 1) {
      const nextLocation = FLOW_STEPS[currentIndex + 1];
      updatePartMutation.mutate({ 
        id: part.id, 
        data: { location: nextLocation } 
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#111827]">Parts & Materials</h3>
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `/jobs?action=create&projectId=${projectId}&jobCategory=Logistics`}
                className="hidden md:flex"
            >
                <Truck className="w-4 h-4 mr-2" />
                Create Logistics Job
            </Button>
            <Button
            onClick={handleAddPart}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
            <Plus className="w-4 h-4 mr-1" />
            Add Part
            </Button>
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="bg-white p-3 rounded-full inline-block mb-3 shadow-sm">
            <Truck className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 mb-4">No parts tracked for this project yet.</p>
          <Button variant="outline" onClick={handleAddPart}>Order First Part</Button>
        </div>
      ) : (
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-sm">
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-slate-50 border-b border-[#E5E7EB] text-xs font-medium text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Part / Category</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Supplier / Source</div>
            <div className="col-span-2">Logistics Links</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Parts List */}
          <div className="divide-y divide-[#E5E7EB]">
            {parts.map((part) => {
              const isOverdue = (part.status === 'Ordered' || part.status === 'Back-ordered') && 
                                part.eta && isPast(parseISO(part.eta));
              
              // Determine progress index
              const progressIndex = FLOW_STEPS.indexOf(part.location);
              const progressPercent = progressIndex === -1 ? 0 : ((progressIndex + 1) / FLOW_STEPS.length) * 100;

              return (
                <div 
                  key={part.id} 
                  onClick={() => handleEditPart(part)}
                  className={`group hover:bg-blue-50/50 transition-colors cursor-pointer ${isOverdue ? 'bg-amber-50/30' : ''}`}
                >
                  <div className="md:grid grid-cols-12 gap-4 p-4 items-center">
                    
                    {/* Col 1: Part Info */}
                    <div className="col-span-12 md:col-span-3 mb-2 md:mb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{part.category}</div>
                          {isOverdue && (
                            <div className="flex items-center text-xs text-amber-600 font-medium mt-0.5">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Overdue
                            </div>
                          )}
                          {/* Progress Bar (Mobile Only) */}
                          <div className="md:hidden mt-2 w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Status */}
                    <div className="col-span-6 md:col-span-2 mb-2 md:mb-0">
                      <Badge className={`${statusColors[part.status]} font-medium border px-2.5 py-0.5`}>
                        {part.status}
                      </Badge>
                      {part.eta && (
                        <div className="text-xs text-slate-500 mt-1">
                          ETA: {format(parseISO(part.eta), 'MMM d')}
                        </div>
                      )}
                    </div>

                    {/* Col 3: Location + Progress */}
                    <div className="col-span-6 md:col-span-2 mb-2 md:mb-0">
                      <Badge className={`${locationColors[part.location] || 'bg-slate-100 text-slate-600'} border-0 font-normal`}>
                        <MapPin className="w-3 h-3 mr-1 opacity-70" />
                        {part.location}
                      </Badge>
                      
                      {/* Progress Trail (Desktop) */}
                      <div className="hidden md:flex items-center gap-1 mt-1.5">
                        {FLOW_STEPS.map((step, idx) => (
                          <div 
                            key={step}
                            className={`h-1 flex-1 rounded-full ${idx <= progressIndex ? 'bg-green-500' : 'bg-slate-200'}`}
                            title={step}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Col 4: Supplier & Details */}
                    <div className="col-span-6 md:col-span-2 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{part.supplier_name || "Unknown Supplier"}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{part.source_type}</div>
                      {(part.order_reference || part.order_date) && (
                          <div className="text-[10px] text-slate-400 mt-1">
                              {part.order_reference && <span>Ref: {part.order_reference}</span>}
                              {part.order_reference && part.order_date && <span> • </span>}
                              {part.order_date && <span>{part.order_date}</span>}
                          </div>
                      )}
                    </div>

                    {/* Col 5: Logistics Chips */}
                    <div className="col-span-6 md:col-span-2">
                      <div className="flex flex-wrap gap-1">
                        {(part.linked_logistics_jobs || []).length > 0 ? (
                          part.linked_logistics_jobs.map((jobId, idx) => (
                            <a 
                                key={jobId} 
                                href={`/jobs?jobId=${jobId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="no-underline"
                            >
                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer">
                                <Truck className="w-2 h-2 mr-1" />
                                Job
                                </Badge>
                            </a>
                          ))
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                              <span className="text-xs text-slate-400 italic">No linked jobs</span>
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-[10px] text-blue-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateLogisticsJob(part);
                                }}
                              >
                                  + Create Job
                              </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Col 6: Actions */}
                    <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-2 mt-2 md:mt-0">
                      {part.status === 'Ordered' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                          title="Mark Delivered"
                          onClick={(e) => markDelivered(e, part)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this part?')) deletePartMutation.mutate(part.id);
                        }}
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <PartDetailModal
          open={showModal}
          part={editingPart}
          onClose={() => {
            setShowModal(false);
            setEditingPart(null);
          }}
          onSave={handleSave}
          isSubmitting={createPartMutation.isPending || updatePartMutation.isPending}
        />
      )}
    </div>
  );
}