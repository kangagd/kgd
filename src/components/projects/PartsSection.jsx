import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Link as LinkIcon, MapPin, Truck, CheckCircle2, AlertTriangle, Package, ArrowRight, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PartDetailModal from "./PartDetailModal";
import PurchaseOrderDetail from "../logistics/PurchaseOrderDetail";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PART_STATUS, LOGISTICS_LOCATION } from "@/components/domain/logisticsConfig";

const statusColors = {
  [PART_STATUS.ON_ORDER]: "bg-slate-100 text-slate-700",
  [PART_STATUS.IN_TRANSIT]: "bg-blue-100 text-blue-700",
  [PART_STATUS.ARRIVED]: "bg-green-100 text-green-700",
  [PART_STATUS.IN_LOADING_BAY]: "bg-indigo-100 text-indigo-700",
  [PART_STATUS.IN_STORAGE]: "bg-purple-100 text-purple-700",
  [PART_STATUS.ON_VEHICLE]: "bg-amber-100 text-amber-700",
  [PART_STATUS.INSTALLED]: "bg-emerald-100 text-emerald-700",
  // Legacy statuses
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
  "At Client Site": "bg-green-50 text-green-600",
  [LOGISTICS_LOCATION.LOADING_BAY]: "bg-blue-50 text-blue-600",
  [LOGISTICS_LOCATION.STORAGE]: "bg-purple-50 text-purple-600",
  [LOGISTICS_LOCATION.VEHICLE]: "bg-amber-50 text-amber-600",
  [LOGISTICS_LOCATION.SITE]: "bg-green-50 text-green-600"
};

// Flow steps for progress bar
const FLOW_STEPS = ["On Order", "At Delivery Bay", "In Warehouse Storage", "With Technician", "At Client Site"];

export default function PartsSection({ projectId, autoExpand = false }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const movePartMutation = useMutation({
    mutationFn: ({ part_ids, from_location, to_location }) => 
      base44.functions.invoke('recordStockMovement', {
        part_ids,
        from_location,
        to_location,
        project_id: projectId
      }),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
        toast.success("Part moved successfully");
      } else {
        toast.error(response.data?.error || "Failed to move part");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to move part");
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

  const handleSave = async (data) => {
    return new Promise((resolve, reject) => {
      const successCallback = (result) => {
        const savedPart = result?.data?.part || { ...data, id: result?.data?.id };
        resolve(savedPart);
      };

      if (editingPart?.id) {
        updatePartMutation.mutate(
          { id: editingPart.id, data },
          { 
            onSuccess: successCallback,
            onError: reject
          }
        );
      } else {
        createPartMutation.mutate(
          { ...data, project_id: projectId },
          { 
            onSuccess: successCallback,
            onError: reject
          }
        );
      }
    });
  };

  // DEPRECATED: Direct status update - kept for legacy parts compatibility
  const markDelivered = (e, part) => {
    e.stopPropagation();
    // Old schema parts still need this direct update
    updatePartMutation.mutate({ 
      id: part.id, 
      data: { 
        status: "Delivered", 
        location: "At Delivery Bay" 
      } 
    });
  };

  const handleMovePart = (e, part, toLocation) => {
    e.stopPropagation();
    const fromLocation = part.location || LOGISTICS_LOCATION.LOADING_BAY;
    movePartMutation.mutate({
      part_ids: [part.id],
      from_location: fromLocation,
      to_location: toLocation
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#111827]">Parts & Materials</h3>
        <Button
          onClick={handleAddPart}
          size="sm"
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Part
        </Button>
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
            <div className="col-span-2">Part / Category</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Supplier / PO</div>
            <div className="col-span-2">Logistics</div>
            <div className="col-span-2 text-right">Quick Actions</div>
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
                    <div className="col-span-12 md:col-span-2 mb-2 md:mb-0">
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

                    {/* Col 4: Supplier & PO */}
                    <div className="col-span-6 md:col-span-2 text-sm text-slate-600">
                      <div className="font-medium">{part.supplier_name || "Unknown Supplier"}</div>
                      {part.purchase_order_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPart(part);
                          }}
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          {part.order_reference || (part.po_number ? `PO #${part.po_number}` : `PO #${part.purchase_order_id.substring(0, 8)}`)}
                        </button>
                      ) : (
                        <div className="text-xs opacity-80">{part.source_type?.split(' – ')[0]}</div>
                      )}
                    </div>

                    {/* Col 5: Logistics Chips */}
                    <div className="col-span-6 md:col-span-2">
                      <div className="flex flex-wrap gap-1">
                        {(part.linked_logistics_jobs || []).length > 0 ? (
                          part.linked_logistics_jobs.map((jobId) => (
                            <button
                              key={jobId}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`${createPageUrl("Jobs")}?jobId=${jobId}`);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                            >
                              <LinkIcon className="w-3 h-3" />
                              Job #{jobId.substring(0, 8)}
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No linked jobs</span>
                        )}
                      </div>
                    </div>

                    {/* Col 6: Quick Actions */}
                    <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-2 mt-2 md:mt-0 flex-wrap">
                      {/* Show move buttons for parts in Loading Bay */}
                      {(part.location === LOGISTICS_LOCATION.LOADING_BAY || part.location === "At Delivery Bay") && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs"
                            title="Move to Storage"
                            onClick={(e) => handleMovePart(e, part, LOGISTICS_LOCATION.STORAGE)}
                            disabled={movePartMutation.isPending}
                          >
                            <Package className="w-3 h-3 mr-1" />
                            Storage
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs"
                            title="Move to Vehicle"
                            onClick={(e) => handleMovePart(e, part, LOGISTICS_LOCATION.VEHICLE)}
                            disabled={movePartMutation.isPending}
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            Vehicle
                          </Button>
                        </>
                      )}
                      {/* Show move to site button for parts on vehicle */}
                      {(part.location === LOGISTICS_LOCATION.VEHICLE || part.location === "With Technician") && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs"
                          title="Move to Site"
                          onClick={(e) => handleMovePart(e, part, LOGISTICS_LOCATION.SITE)}
                          disabled={movePartMutation.isPending}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Site
                        </Button>
                      )}
                      {/* Legacy mark delivered for old parts */}
                      {part.status === 'Ordered' && !part.location?.includes('Bay') && !part.location?.includes('Loading') && (
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
          projectId={projectId}
          onClose={() => {
            setShowModal(false);
            setEditingPart(null);
          }}
          onSave={handleSave}
          isSubmitting={createPartMutation.isPending || updatePartMutation.isPending}
        />
      )}

      {selectedPoId && (
        <PurchaseOrderDetail
          poId={selectedPoId}
          onClose={() => setSelectedPoId(null)}
        />
      )}
    </div>
  );
}