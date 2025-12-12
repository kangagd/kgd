import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Package, Truck, ExternalLink, Plus, ShoppingCart } from "lucide-react";
import AssignPartToVehicleModal from "./AssignPartToVehicleModal";
import { PART_LOCATION, normaliseLegacyPartLocation, getPartStatusLabel, normaliseLegacyPartStatus } from "@/components/domain/partConfig";
import { getPoStatusLabel } from "@/components/domain/purchaseOrderStatusConfig";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function ProjectPartsPanel({ project, parts = [], inventoryByItem = {} }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [partToAssign, setPartToAssign] = useState(null);
  const [showCreatePODialog, setShowCreatePODialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [activePoId, setActivePoId] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleAddPart = () => {
    // Will trigger part modal from PartsSection
    if (window.triggerAddPart) {
      window.triggerAddPart();
    }
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

  const { data: projectPOs = [] } = useQuery({
    queryKey: ['projectPOs', project.id],
    queryFn: () => base44.entities.PurchaseOrder.filter({ project_id: project.id }, '-created_date'),
    enabled: !!project.id
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-po-panel'],
    queryFn: () => base44.entities.Supplier.list('name')
  });

  const detectShortage = (part) => {
    // Not a shortage if status is beyond pending
    const normalizedStatus = part.status?.toLowerCase().replace(/\s+/g, "_");
    if (normalizedStatus !== 'pending') {
      return false;
    }

    const normalizedLocation = normaliseLegacyPartLocation(part.location);
    const isOnOrder = !normalizedLocation || normalizedLocation === PART_LOCATION.SUPPLIER;
    
    if (!isOnOrder) {
      return false;
    }

    // If pending and on order, check stock availability
    const requiredQty = part.quantity_required || 1;
    if (part.price_list_item_id) {
       const availableQty = inventoryByItem[part.price_list_item_id] || 0;
       return availableQty < requiredQty;
    }
    
    // No price list item linked = unknown stock, treat as shortage
    return true; 
  };

  const needed = parts.filter(p => detectShortage(p));
  const ready = parts.filter(p => !detectShortage(p));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Project Parts & Ordering</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Purchase orders and parts for this project. "Shortages" = Parts requiring ordering. "Ready" = Parts available to pick.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreatePODialog(true)}
            size="sm"
            variant="outline"
            title="Create a Purchase Order for this project"
          >
            <ShoppingCart className="w-4 h-4 mr-1" />
            Create PO
          </Button>
          <Button
            onClick={handleAddPart}
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            title="Add a Part required for this project"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Part
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            Print Pick List
          </Button>
        </div>
      </div>

      {/* Purchase Orders */}
      {projectPOs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#111827] flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" />
            Purchase Orders ({projectPOs.length})
          </h4>
          <div className="space-y-2">
            {projectPOs.map(po => (
              <button
                key={po.id}
                onClick={() => setActivePoId(po.id)}
                className="w-full p-4 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {(() => {
                          const poRef = po.po_number || po.order_reference || po.reference || po.id.substring(0, 8);
                          return `PO #${poRef}`;
                        })()}
                      </span>
                      <Badge className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {getPoStatusLabel(po.status)}
                      </Badge>
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {po.supplier_name || 'Supplier'}
                      {po.expected_date && ` • ETA: ${format(new Date(po.expected_date), 'MMM d, yyyy')}`}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#6B7280] flex-shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {parts.length === 0 && projectPOs.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-2">No parts tracked yet</p>
          <p className="text-xs text-gray-400">Order your first part to get started</p>
        </div>
      )}

      {needed.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-red-600 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Shortages ({needed.length})
          </h4>
          <div className="space-y-2">
            {needed.map(part => {
              const partTitle = part.item_name || part.category || "Part";
              const normalizedStatus = normaliseLegacyPartStatus(part.status);
              const poDisplay = (() => {
                const poRef = part.po_number || part.order_reference || part.reference;
                return poRef ? `PO #${poRef}` : null;
              })();
              
              return (
                <div key={part.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-red-900">{partTitle}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {part.supplier_name && (
                        <span className="text-xs text-red-700">
                          {part.supplier_name}
                        </span>
                      )}
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-[11px] px-2 py-0">
                        {getPartStatusLabel(normalizedStatus)}
                      </Badge>
                      {poDisplay && (
                        <span className="text-xs text-red-700">
                          {poDisplay}
                        </span>
                      )}
                    </div>
                    {part.price_list_item_id && (
                      <div className="text-xs text-red-600 mt-0.5">
                        Stock Available: {inventoryByItem[part.price_list_item_id] || 0}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex flex-col gap-2 items-end">
                     <Badge variant="outline" className="bg-white border-red-200 text-red-800">
                       Qty: {part.quantity_required || 1}
                     </Badge>
                     
                     {normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-7 text-xs"
                         onClick={() => {
                           setPartToAssign(part);
                           setAssignModalOpen(true);
                         }}
                       >
                         Assign to vehicle
                       </Button>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-green-700 flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Ready to Pick / Assigned ({ready.length})
          </h4>
          <div className="space-y-2">
            {ready.map(part => {
              const partTitle = part.item_name || part.category || "Part";
              const normalizedStatus = normaliseLegacyPartStatus(part.status);
              const poDisplay = (() => {
                const poRef = part.po_number || part.order_reference || part.reference;
                return poRef ? `PO #${poRef}` : null;
              })();
              
              return (
                <div key={part.id} className="p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{partTitle}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {part.supplier_name && (
                        <span className="text-xs text-gray-600">
                          {part.supplier_name}
                        </span>
                      )}
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[11px] px-2 py-0">
                        {getPartStatusLabel(normalizedStatus)}
                      </Badge>
                      {poDisplay && (
                        <span className="text-xs text-gray-600">
                          {poDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge variant="outline" className="bg-gray-50">
                      Qty: {part.quantity_required || 1}
                    </Badge>
                    
                    {(normaliseLegacyPartLocation(part.location) !== PART_LOCATION.VEHICLE || !part.assigned_vehicle_id) && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                         onClick={() => {
                           setPartToAssign(part);
                           setAssignModalOpen(true);
                         }}
                       >
                         <Truck className="w-3 h-3 mr-1" />
                         Assign to vehicle
                       </Button>
                     )}
                  </div>
                </div>
              );
            })}
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
            <Button variant="outline" onClick={() => setShowCreatePODialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePO} disabled={!selectedSupplierId}>
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
    </div>
  );
}