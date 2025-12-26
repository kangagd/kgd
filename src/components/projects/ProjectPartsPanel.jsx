import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Package, Truck, ExternalLink, Plus, ShoppingCart, MoreVertical, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import AssignPartToVehicleModal from "./AssignPartToVehicleModal";
import { PART_LOCATION, normaliseLegacyPartLocation, getPartStatusLabel, normaliseLegacyPartStatus, getNormalizedPartStatus, isPickablePart, PICKABLE_STATUSES, PART_STATUS } from "@/components/domain/partConfig";
import { getPoStatusLabel } from "@/components/domain/purchaseOrderStatusConfig";
import { getPoIdentity } from "@/components/domain/poDisplayHelpers";
import { getPoEta, getPoSupplierName, safeParseDate } from "@/components/domain/schemaAdapters";


import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import PurchaseOrderModal from "../logistics/PurchaseOrderModal";
import PartDetailModal from "./PartDetailModal";

export default function ProjectPartsPanel({ project, parts = [], inventoryByItem = {}, purchaseOrders = [], missingCount = 0 }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [partToAssign, setPartToAssign] = useState(null);
  const [showCreatePODialog, setShowCreatePODialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [activePoId, setActivePoId] = useState(null);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [posExpanded, setPosExpanded] = useState(() => {
    const hasShortages = parts.filter(p => !isPickablePart(p) && getNormalizedPartStatus(p) !== 'cancelled' && getNormalizedPartStatus(p) !== 'installed').length > 0;
    return hasShortages;
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createPartMutation = useMutation({
    mutationFn: (data) => {
      const partData = {
        ...data,
        project_id: project.id,
        status: PART_STATUS.PENDING,
        location: PART_LOCATION.SUPPLIER,
        purchase_order_id: null
      };
      return base44.functions.invoke('managePart', { action: 'create', data: partData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectParts', project.id] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setShowAddPartModal(false);
      toast.success("Part added successfully");
    }
  });

  const handleAddPart = () => {
    setShowAddPartModal(true);
  };

  const handleSavePart = async (data) => {
    return new Promise((resolve, reject) => {
      createPartMutation.mutate(data, {
        onSuccess: (result) => {
          const savedPart = result?.data?.part || { ...data, id: result?.data?.id };
          resolve(savedPart);
        },
        onError: reject
      });
    });
  };

  const openOrCreateProjectSupplierPO = async (supplierId) => {
    if (!project?.id || !supplierId) {
      toast.error("Project and supplier must be set");
      return;
    }

    try {
      const response = await base44.functions.invoke("managePurchaseOrder", {
        action: "getOrCreateProjectSupplierDraft",
        project_id: project.id,
        supplier_id: supplierId,
      });

      if (!response?.data?.success || !response.data.purchaseOrder) {
        toast.error(response?.data?.error || "Failed to open/create Purchase Order");
        return;
      }

      const po = response.data.purchaseOrder;
      setActivePoId(po.id);
    } catch (error) {
      toast.error("Error opening/creating Purchase Order");
    }
  };

  const handleCreatePO = async () => {
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    setShowCreatePODialog(false);
    await openOrCreateProjectSupplierPO(selectedSupplierId);
    setSelectedSupplierId("");
  };

  // Use passed purchaseOrders prop instead of fetching again
  const projectPOs = purchaseOrders;

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name')
  });

  const { data: allPOLines = [] } = useQuery({
    queryKey: ['projectPOLines', project.id],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  // Build map: PO line ID → PO ID
  const poLineToPoMap = React.useMemo(() => {
    const map = new Map();
    for (const line of allPOLines) {
      if (line.id && line.purchase_order_id) {
        map.set(line.id, line.purchase_order_id);
      }
    }
    return map;
  }, [allPOLines]);

  // Helper to resolve PO for a part (handles both direct PO ID and PO line ID)
  const resolvePartPO = (part) => {
    if (part.purchase_order_id) {
      return projectPOs.find(po => po.id === part.purchase_order_id);
    }
    if (part.purchase_order_line_id) {
      const poId = poLineToPoMap.get(part.purchase_order_line_id);
      if (poId) {
        return projectPOs.find(po => po.id === poId);
      }
    }
    return null;
  };

  // STRICT FILTERING: ready = only parts that pass isPickablePart
  const ready = parts.filter(isPickablePart);
  const needed = parts.filter(p => !isPickablePart(p) && getNormalizedPartStatus(p) !== 'cancelled' && getNormalizedPartStatus(p) !== 'installed');

  // Fetch logistics jobs for this project
  const { data: projectLogisticsJobs = [] } = useQuery({
    queryKey: ['projectLogisticsJobsForParts', project.id],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({
        project_id: project.id,
        $or: [
          { purchase_order_id: { $ne: null } },
          { third_party_trade_id: { $ne: null } }
        ]
      });
      return jobs;
    },
    enabled: !!project.id,
    staleTime: 60_000
  });

  // Count logistics jobs per PO
  const logisticsJobsByPO = React.useMemo(() => {
    const map = new Map();
    for (const job of projectLogisticsJobs) {
      if (job.purchase_order_id) {
        const count = map.get(job.purchase_order_id) || 0;
        map.set(job.purchase_order_id, count + 1);
      }
    }
    return map;
  }, [projectLogisticsJobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] text-[#6B7280]">
            Track parts needed and ready for installation.
          </p>
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreatePODialog(true);
              }}
              size="sm"
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
              title="Create a Purchase Order for missing parts"
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Create PO
            </Button>
          )}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleAddPart();
            }}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            title="Add a Part required for this project"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Part
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {missingCount === 0 && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreatePODialog(true);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create PO
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                Print Pick List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Purchase Orders - Inline Summary */}
      {projectPOs.length > 0 && (
        <Collapsible open={posExpanded} onOpenChange={setPosExpanded}>
          <div className="border border-[#E5E7EB] rounded-lg bg-white">
            <CollapsibleTrigger asChild>
              <button className="w-full p-3 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#6B7280]" />
                  <h4 className="text-sm font-medium text-[#111827]">
                    Purchase Orders ({projectPOs.length})
                  </h4>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${posExpanded ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>

            {!posExpanded && (
              <div className="px-3 pb-3 space-y-1">
                {projectPOs
                  .filter(po => po.status !== 'received' && po.status !== 'completed' && po.status !== 'cancelled')
                  .slice(0, 2)
                  .map(po => {
                    const supplier = suppliers.find(s => s.id === po.supplier_id);
                    const supplierName = supplier?.name || getPoSupplierName(po) || "Unknown Supplier";
                    const eta = getPoEta(po);
                    const etaDate = safeParseDate(eta);
                    
                    return (
                    <div key={po.id} className="text-xs text-[#6B7280]">
                      <span className="font-medium text-[#111827]">
                        {getPoIdentity(po).reference}
                      </span>
                      {' • '}
                      {supplierName}
                      {etaDate && ` • ETA: ${format(etaDate, 'MMM d')}`}
                    </div>
                    );
                  })}
                {projectPOs.filter(po => po.status !== 'received' && po.status !== 'completed' && po.status !== 'cancelled').length === 0 && (
                  <div className="text-xs text-[#9CA3AF]">All POs closed</div>
                )}
              </div>
            )}

            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-2">
                {projectPOs.map(po => {
                  const supplier = suppliers.find(s => s.id === po.supplier_id);
                  const supplierName = supplier?.name || getPoSupplierName(po) || "Unknown Supplier";
                  const eta = getPoEta(po);
                  const etaDate = safeParseDate(eta);
                  const logisticsCount = logisticsJobsByPO.get(po.id) || 0;
                  
                  // Count line items for this PO
                  const itemsCount = allPOLines.filter(line => line.purchase_order_id === po.id).length;
                  
                  return (
                  <button
                    key={po.id}
                    onClick={() => setActivePoId(po.id)}
                    className="w-full p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm">
                            {getPoIdentity(po).reference}
                          </span>
                          <Badge className="text-xs bg-slate-100 text-slate-700">
                            {getPoStatusLabel(po.status)}
                          </Badge>
                        </div>
                        <div className="text-xs text-[#6B7280] space-y-0.5">
                          <div>{supplierName}</div>
                          {itemsCount > 0 && (
                            <div>{itemsCount} item{itemsCount > 1 ? 's' : ''}</div>
                          )}
                          {etaDate && (
                            <div>ETA: {format(etaDate, "MMM d, yyyy")}</div>
                          )}
                        </div>
                        {logisticsCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById('logistics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            View logistics ({logisticsCount})
                          </button>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-[#6B7280] flex-shrink-0 ml-2" />
                    </div>
                  </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {parts.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No parts tracked yet</p>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleAddPart();
            }}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Part
          </Button>
        </div>
      )}

      {needed.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-red-600 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Shortages ({needed.length})
          </h4>
          <div className="space-y-3">
            {(() => {
              // Group parts by PO
              const partsByPO = new Map();
              const partsWithoutPO = [];
              
              needed.forEach(part => {
                const linkedPO = resolvePartPO(part);
                if (linkedPO) {
                  if (!partsByPO.has(linkedPO.id)) {
                    partsByPO.set(linkedPO.id, { po: linkedPO, parts: [] });
                  }
                  partsByPO.get(linkedPO.id).parts.push(part);
                } else {
                  partsWithoutPO.push(part);
                }
              });
              
              return (
                <>
                  {/* Parts grouped by PO */}
                  {Array.from(partsByPO.values()).map(({ po, parts }) => {
                    const eta = getPoEta(po);
                    const etaDate = safeParseDate(eta);
                    const logisticsCount = logisticsJobsByPO.get(po.id) || 0;
                    
                    return (
                      <div key={po.id} className="border border-red-200 rounded-lg bg-red-50/50 overflow-hidden">
                        {/* PO Summary Header */}
                        <div className="bg-red-100/50 px-3 py-2 border-b border-red-200">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setActivePoId(po.id)}
                              className="flex items-center gap-2 flex-wrap hover:opacity-80 transition-opacity"
                            >
                              <span className="text-sm font-semibold text-red-900 underline decoration-dotted underline-offset-2">
                                {getPoIdentity(po).reference}
                              </span>
                              {getPoIdentity(po).name && (
                                <span className="text-xs text-red-700">• {getPoIdentity(po).name}</span>
                              )}
                              <Badge className="bg-red-200 text-red-900 border-red-300 text-[10px]">
                                {getPoStatusLabel(po.status)}
                              </Badge>
                              {etaDate && (
                                <span className="text-xs text-red-700">• ETA: {format(etaDate, 'MMM d')}</span>
                              )}
                            </button>
                            {logisticsCount > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => document.getElementById('logistics')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-6 px-2 text-xs text-red-700 hover:bg-red-200"
                              >
                                <Truck className="w-3 h-3 mr-1" />
                                Logistics ({logisticsCount})
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Parts List */}
                        <div className="divide-y divide-red-100">
                          {parts.map(part => {
                            const partTitle = part.item_name || part.category || "Part";
                            const normalizedStatus = getNormalizedPartStatus(part);
                            
                            return (
                              <div key={part.id} className="p-3 flex justify-between items-center bg-red-50">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-red-900">{partTitle}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0">
                                      {getPartStatusLabel(normalizedStatus)}
                                    </Badge>
                                    <span className="text-xs text-red-700">Qty: {part.quantity_required || 1}</span>
                                  </div>
                                </div>
                                {normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPartToAssign(part);
                                      setAssignModalOpen(true);
                                    }}
                                  >
                                    Assign
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Parts without PO */}
                  {partsWithoutPO.map(part => {
                    const partTitle = part.item_name || part.category || "Part";
                    const normalizedStatus = getNormalizedPartStatus(part);
                    
                    return (
                      <div key={part.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-red-900">{partTitle}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {part.supplier_name && (
                              <span className="text-xs text-red-700">{part.supplier_name}</span>
                            )}
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0">
                              {getPartStatusLabel(normalizedStatus)}
                            </Badge>
                            <span className="text-xs text-red-700">Qty: {part.quantity_required || 1}</span>
                          </div>
                        </div>
                        {normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPartToAssign(part);
                              setAssignModalOpen(true);
                            }}
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-green-700 flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Ready to Pick / Assigned ({ready.length})
          </h4>
          <div className="space-y-3">
            {(() => {
              // Group parts by PO
              const partsByPO = new Map();
              const partsWithoutPO = [];
              
              ready.forEach(part => {
                // DEFENSIVE GUARD: Double-check pickability
                if (!isPickablePart(part)) {
                  console.warn('[ProjectPartsPanel] Non-pickable part in ready list:', part.id);
                  return;
                }
                
                const linkedPO = resolvePartPO(part);
                if (linkedPO) {
                  if (!partsByPO.has(linkedPO.id)) {
                    partsByPO.set(linkedPO.id, { po: linkedPO, parts: [] });
                  }
                  partsByPO.get(linkedPO.id).parts.push(part);
                } else {
                  partsWithoutPO.push(part);
                }
              });
              
              return (
                <>
                  {/* Parts grouped by PO */}
                  {Array.from(partsByPO.values()).map(({ po, parts }) => {
                    const eta = getPoEta(po);
                    const etaDate = safeParseDate(eta);
                    const logisticsCount = logisticsJobsByPO.get(po.id) || 0;
                    
                    return (
                      <div key={po.id} className="border border-green-200 rounded-lg bg-white overflow-hidden">
                        {/* PO Summary Header */}
                        <div className="bg-green-50 px-3 py-2 border-b border-green-200">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setActivePoId(po.id)}
                              className="flex items-center gap-2 flex-wrap hover:opacity-80 transition-opacity"
                            >
                              <span className="text-sm font-semibold text-green-900 underline decoration-dotted underline-offset-2">
                                {getPoIdentity(po).reference}
                              </span>
                              {getPoIdentity(po).name && (
                                <span className="text-xs text-green-700">• {getPoIdentity(po).name}</span>
                              )}
                              <Badge className="bg-green-200 text-green-900 border-green-300 text-[10px]">
                                {getPoStatusLabel(po.status)}
                              </Badge>
                              {etaDate && (
                                <span className="text-xs text-green-700">• ETA: {format(etaDate, 'MMM d')}</span>
                              )}
                            </button>
                            {logisticsCount > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => document.getElementById('logistics')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-6 px-2 text-xs text-green-700 hover:bg-green-100"
                              >
                                <Truck className="w-3 h-3 mr-1" />
                                Logistics ({logisticsCount})
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Parts List */}
                        <div className="divide-y divide-gray-100">
                          {parts.map(part => {
                            const partTitle = part.item_name || part.category || "Part";
                            const normalizedStatus = getNormalizedPartStatus(part);
                            
                            return (
                              <div key={part.id} className="p-3 flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">{partTitle}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] px-1.5 py-0">
                                      {getPartStatusLabel(normalizedStatus)}
                                    </Badge>
                                    <span className="text-xs text-gray-600">Qty: {part.quantity_required || 1}</span>
                                  </div>
                                </div>
                                {(normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE || !part.assigned_vehicle_id) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPartToAssign(part);
                                      setAssignModalOpen(true);
                                    }}
                                  >
                                    <Truck className="w-3 h-3 mr-1" />
                                    Assign
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Parts without PO */}
                  {partsWithoutPO.map(part => {
                    const partTitle = part.item_name || part.category || "Part";
                    const normalizedStatus = getNormalizedPartStatus(part);
                    
                    return (
                      <div key={part.id} className="p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{partTitle}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {part.supplier_name && (
                              <span className="text-xs text-gray-600">{part.supplier_name}</span>
                            )}
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] px-1.5 py-0">
                              {getPartStatusLabel(normalizedStatus)}
                            </Badge>
                            <span className="text-xs text-gray-600">Qty: {part.quantity_required || 1}</span>
                          </div>
                        </div>
                        {(normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE || !part.assigned_vehicle_id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPartToAssign(part);
                              setAssignModalOpen(true);
                            }}
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            Assign
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <AssignPartToVehicleModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setPartToAssign(null);
        }}
        part={partToAssign}
        project={project}
        defaultQuantity={partToAssign?.quantity_required || partToAssign?.quantity || 1}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ['projectParts', project?.id] });
          queryClient.invalidateQueries({ queryKey: ['parts'] });
        }}
      />

      <Dialog open={showCreatePODialog} onOpenChange={setShowCreatePODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Supplier</label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.is_active).map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6B7280]">
                A draft PO will be created (or opened if one already exists) for this project and supplier.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                setShowCreatePODialog(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                handleCreatePO();
              }}
              disabled={!selectedSupplierId}
            >
              Create / Open PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PurchaseOrderModal
        poId={activePoId}
        open={!!activePoId}
        onClose={() => setActivePoId(null)}
      />

      <PartDetailModal
        open={showAddPartModal}
        part={null}
        projectId={project.id}
        onClose={() => setShowAddPartModal(false)}
        onSave={handleSavePart}
        isSubmitting={createPartMutation.isPending}
      />
    </div>
  );
}