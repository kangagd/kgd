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
import { PART_STATUS, PART_LOCATION, getPartStatusLabel, getPartLocationLabel, normaliseLegacyPartStatus, normaliseLegacyPartLocation, isPartAvailable } from "@/components/domain/partConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper for consistent PO reference display
function getPoDisplayRef(po, part) {
  return (
    po?.po_number ||
    po?.po_reference ||
    po?.order_reference ||
    po?.reference ||
    part?.po_number ||
    part?.order_reference ||
    (po?.id ? String(po.id).slice(0, 8) : "") ||
    ""
  );
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors = {
  pending: "bg-slate-100 text-slate-700",
  on_order: "bg-blue-100 text-blue-700",
  in_transit: "bg-purple-100 text-purple-700",
  in_loading_bay: "bg-cyan-100 text-cyan-700",
  in_storage: "bg-emerald-100 text-emerald-700",
  in_vehicle: "bg-teal-100 text-teal-700",
  installed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const locationColors = {
  supplier: "bg-indigo-50 text-indigo-600",
  loading_bay: "bg-blue-50 text-blue-600",
  warehouse_storage: "bg-purple-50 text-purple-600",
  vehicle: "bg-amber-50 text-amber-600",
  client_site: "bg-green-50 text-green-600",
};

// Flow steps for progress bar
const FLOW_STEPS = [
  "supplier", 
  "loading_bay", 
  "warehouse_storage", 
  "vehicle", 
  "client_site"
];

export default function PartsSection({ projectId, autoExpand = false, registerAddPartTrigger }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: allParts = [] } = useQuery({
    queryKey: ['parts', projectId],
    queryFn: () => base44.entities.Part.filter({ project_id: projectId }, '-order_date')
  });

  // Split parts: Ready to pick (available) vs Not ready (unavailable)
  const partsReadyToPick = allParts.filter(part => {
    const normalized = { ...part, status: normaliseLegacyPartStatus(part.status, part), location: normaliseLegacyPartLocation(part.location) };
    return isPartAvailable(normalized);
  });
  const partsNotReady = allParts.filter(part => {
    const normalized = { ...part, status: normaliseLegacyPartStatus(part.status, part), location: normaliseLegacyPartLocation(part.location) };
    return !isPartAvailable(normalized);
  });
  const parts = [...partsReadyToPick, ...partsNotReady]; // Show ready parts first

  const { data: projectPOs = [] } = useQuery({
    queryKey: ['projectPOs-partsSection', projectId],
    queryFn: () => base44.entities.PurchaseOrder.filter({ project_id: projectId }),
    enabled: !!projectId
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

  const handleAddPart = () => {
    setEditingPart(null); // null indicates new
    setShowModal(true);
  };

  React.useEffect(() => {
    if (registerAddPartTrigger) {
      registerAddPartTrigger(handleAddPart);
    }
  }, [registerAddPartTrigger]);

  useEffect(() => {
    if (autoExpand && parts.length === 0) {
      handleAddPart();
    }
  }, [autoExpand, parts.length, projectId]);

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



  const handleMovePart = (e, part, toLocation) => {
    e.stopPropagation();
    const fromLocation = normaliseLegacyPartLocation(part.location) || PART_LOCATION.DELIVERY_BAY;
    movePartMutation.mutate({
      part_ids: [part.id],
      from_location: fromLocation,
      to_location: toLocation
    });
  };

  return (
    <div className="space-y-4">

      {parts.length === 0 && projectPOs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="bg-white p-3 rounded-full inline-block mb-3 shadow-sm">
            <Truck className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 mb-4">No parts tracked for this project yet.</p>
          <Button variant="outline" onClick={handleAddPart}>Order First Part</Button>
        </div>
      ) : parts.length > 0 ? (
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
              
              const normalizedStatus = normaliseLegacyPartStatus(part.status, part);
              let displayLocation = normaliseLegacyPartLocation(part.location);

              // If location is missing or still "supplier", derive a better display location from status
              if (!displayLocation || displayLocation === PART_LOCATION.SUPPLIER) {
                switch (normalizedStatus) {
                  case PART_STATUS.IN_LOADING_BAY:
                    displayLocation = PART_LOCATION.LOADING_BAY;
                    break;
                  case PART_STATUS.IN_STORAGE:
                    displayLocation = PART_LOCATION.WAREHOUSE_STORAGE;
                    break;
                  case PART_STATUS.IN_VEHICLE:
                    displayLocation = PART_LOCATION.VEHICLE;
                    break;
                  case PART_STATUS.IN_TRANSIT:
                    // Treat in-transit as heading to loading bay for display purposes
                    displayLocation = PART_LOCATION.LOADING_BAY;
                    break;
                  default:
                    // leave as supplier or whatever it already was
                    break;
                }
              }
              
              // Determine progress index using displayLocation
              const progressIndex = FLOW_STEPS.indexOf(displayLocation);
              const progressPercent = progressIndex === -1 ? 0 : ((progressIndex + 1) / FLOW_STEPS.length) * 100;

              const partTitle = part.item_name || part.category || "Part";

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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">
                              {partTitle}
                            </span>
                            {part.category && (
                              <Badge
                                variant="outline"
                                className="text-[11px] bg-slate-100 text-slate-600 border-slate-200"
                              >
                                {part.category}
                              </Badge>
                            )}
                          </div>

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
                      <Badge className={`${statusColors[normalizedStatus]} font-medium border px-2.5 py-0.5`}>
                        {getPartStatusLabel(normalizedStatus)}
                      </Badge>
                      {part.eta && (
                        <div className="text-xs text-slate-500 mt-1">
                          ETA: {format(parseISO(part.eta), 'MMM d')}
                        </div>
                      )}
                    </div>

                    {/* Col 3: Location + Progress */}
                    <div className="col-span-6 md:col-span-2 mb-2 md:mb-0">
                      <Badge
                        className={`${
                          locationColors[displayLocation] || "bg-slate-100 text-slate-600"
                        } border-0 font-normal`}
                      >
                        <MapPin className="w-3 h-3 mr-1 opacity-70" />
                        {getPartLocationLabel(displayLocation)}
                      </Badge>
                      
                      {/* Progress Trail (Desktop) */}
                      <div className="hidden md:flex items-center gap-1 mt-1.5">
                        {FLOW_STEPS.map((step, idx) => {
                          const currentIndex = FLOW_STEPS.indexOf(displayLocation);
                          return (
                            <div 
                              key={step}
                              className={`h-1 flex-1 rounded-full ${idx <= currentIndex ? 'bg-green-500' : 'bg-slate-200'}`}
                              title={getPartLocationLabel(step)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Col 4: Supplier & PO */}
                    <div className="col-span-6 md:col-span-2 text-sm text-slate-600">
                      {(!part.supplier_name && !part.purchase_order_id) ? (
                        <div className="text-sm text-slate-400">-</div>
                      ) : (
                        <>
                          <div className="font-medium">
                            {part.supplier_name || "-"}
                          </div>

                          {part.purchase_order_id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPart(part);
                              }}
                              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              {(() => {
                                const linkedPO = projectPOs.find(po => po.id === part.purchase_order_id);
                                const poRef = getPoDisplayRef(linkedPO, part);
                                return poRef ? `PO #${poRef}` : `PO #${String(part.purchase_order_id).substring(0, 8)}`;
                              })()}
                            </button>
                          ) : (
                            <div className="text-xs text-slate-400 mt-1">
                              No PO linked
                            </div>
                          )}
                        </>
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
                      {normaliseLegacyPartLocation(part.location) === PART_LOCATION.LOADING_BAY && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs"
                            title="Move to Storage"
                            onClick={(e) => handleMovePart(e, part, PART_LOCATION.WAREHOUSE_STORAGE)}
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
                            onClick={(e) => handleMovePart(e, part, PART_LOCATION.VEHICLE)}
                            disabled={movePartMutation.isPending}
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            Vehicle
                          </Button>
                        </>
                      )}
                      {/* Show move to site button for parts on vehicle */}
                      {normaliseLegacyPartLocation(part.location) === PART_LOCATION.VEHICLE && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs"
                          title="Move to Site"
                          onClick={(e) => handleMovePart(e, part, PART_LOCATION.CLIENT_SITE)}
                          disabled={movePartMutation.isPending}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Site
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
      ) : null}

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