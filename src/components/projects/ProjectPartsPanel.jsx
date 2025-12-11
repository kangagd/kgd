import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Package, Truck, ExternalLink } from "lucide-react";
import AssignPartToVehicleModal from "./AssignPartToVehicleModal";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function ProjectPartsPanel({ project, parts = [], inventoryByItem = {} }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [partToAssign, setPartToAssign] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: projectPOs = [] } = useQuery({
    queryKey: ['projectPOs', project.id],
    queryFn: () => base44.entities.PurchaseOrder.filter({ project_id: project.id }, '-created_date'),
    enabled: !!project.id
  });

  const detectShortage = (part) => {
    // Not a shortage if status is beyond Pending or location is beyond On Order
    if (part.status !== 'Pending') {
      return false;
    }

    const location = part.location;
    const isOnOrder = !location || location === 'On Order';
    
    if (!isOnOrder) {
      return false;
    }

    // If Pending and On Order, check stock availability
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
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Print Pick List
        </Button>
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
                onClick={() => navigate(`${createPageUrl("PurchaseOrders")}?poId=${po.id}`)}
                className="w-full p-4 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {po.po_number || `PO #${po.id.substring(0, 8)}`}
                      </span>
                      <Badge className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {po.status}
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
            {needed.map(part => (
              <div key={part.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-red-900">{part.category}</div>
                  <div className="text-xs text-red-700 mt-0.5">
                    {part.supplier_name || 'No Supplier'} {part.order_reference ? `• ${part.order_reference}` : ''}
                  </div>
                  {part.price_list_item_id && (
                    <div className="text-xs text-red-600 mt-0.5">
                      Stock Available: {inventoryByItem[part.price_list_item_id] || 0}
                    </div>
                  )}
                  {part.purchase_order_id && (
                    <div className="text-xs text-red-700 mt-0.5 opacity-75">
                      Linked to PO #{part.purchase_order_id.substring(0, 8)}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col gap-2 items-end">
                   <Badge variant="outline" className="bg-white border-red-200 text-red-800">
                     Qty: {part.quantity_required || 1}
                   </Badge>
                   
                   {(part.location !== INVENTORY_LOCATION.WITH_TECHNICIAN) && (
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
            ))}
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
            {ready.map(part => (
              <div key={part.id} className="p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900">{part.category}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {part.location}
                    {part.status !== 'Pending' && ` • ${part.status}`}
                  </div>
                  {part.purchase_order_id && (
                    <div className="text-xs text-gray-500 mt-0.5 opacity-75">
                      Linked to PO #{part.purchase_order_id.substring(0, 8)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant="outline" className="bg-gray-50">
                    Qty: {part.quantity_required || 1}
                  </Badge>
                  
                  {(part.location !== INVENTORY_LOCATION.WITH_TECHNICIAN || !part.assigned_vehicle_id) && (
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
            ))}
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
    </div>
  );
}