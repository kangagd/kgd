import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Truck, MapPin, AlertCircle, Link as LinkIcon, Plus, Briefcase, ExternalLink } from "lucide-react";
import PurchaseOrderDetail from "../components/logistics/PurchaseOrderDetail";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import PartDetailModal from "../components/projects/PartDetailModal";
import { toast } from "sonner";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";
import BackButton from "../components/common/BackButton";
import StatusBadge from "../components/common/StatusBadge";
import {
  getIncomingPurchaseOrders,
  getLoadingBayParts,
  getLogisticsJobs,
} from "@/components/domain/logisticsViewHelpers";
import { LOGISTICS_LOCATION, PO_STATUS, PO_DELIVERY_METHOD, PO_STATUS_OPTIONS } from "@/components/domain/logisticsConfig";

const STATUS_COLORS = {
  Pending: "bg-slate-100 text-slate-800 border-slate-200",
  Ordered: "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  Delivered: "bg-green-100 text-green-800 border-green-200",
  Returned: "bg-orange-100 text-orange-800 border-orange-200",
  Cancelled: "bg-red-100 text-red-800 border-red-200",
};

const LOCATION_COLORS = {
  "On Order": "bg-slate-50 text-slate-600",
  [INVENTORY_LOCATION.SUPPLIER]: "bg-indigo-50 text-indigo-600",
  [INVENTORY_LOCATION.DELIVERY_BAY]: "bg-blue-50 text-blue-600",
  [INVENTORY_LOCATION.WAREHOUSE]: "bg-purple-50 text-purple-600",
  [INVENTORY_LOCATION.WITH_TECHNICIAN]: "bg-amber-50 text-amber-600",
  [INVENTORY_LOCATION.AT_CLIENT_SITE]: "bg-green-50 text-green-600",
};

export default function Logistics() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState("orders"); // "orders" | "jobs"
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState("active"); // active, all, or specific status
  const [locationFilter, setLocationFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedPart, setSelectedPart] = useState(null);
  const [showOnlyThirdParty, setShowOnlyThirdParty] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [showAdvancedParts, setShowAdvancedParts] = useState(false);

  // Fetch Data
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list(),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const { data: purchaseOrderLines = [] } = useQuery({
    queryKey: ["purchaseOrderLines"],
    queryFn: () => base44.entities.PurchaseOrderLine.list(),
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ["inventoryQuantities"],
    queryFn: () => base44.entities.InventoryQuantity.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: stockLogisticsJobs = [] } = useQuery({
    queryKey: ["stockLogisticsJobs"],
    queryFn: () =>
      base44.entities.Job.filter({
        purchase_order_id: { $ne: null },
      }),
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ["priceListItems-for-logistics"],
    queryFn: () => base44.entities.PriceListItem.list("item"),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-logistics"],
    queryFn: () => base44.entities.Vehicle.list("name"),
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ["allTradeRequirements"],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("name"),
  });

  const tradesByProjectId = useMemo(() => {
    const map = {};
    for (const trade of allTradeRequirements) {
      if (!map[trade.project_id]) {
        map[trade.project_id] = [];
      }
      map[trade.project_id].push(trade);
    }
    return map;
  }, [allTradeRequirements]);

  // Board data derived from query data (no extra fetch)
  const incomingPOs = useMemo(
    () => getIncomingPurchaseOrders(purchaseOrders),
    [purchaseOrders]
  );
  const loadingBayParts = useMemo(
    () => getLoadingBayParts(parts),
    [parts]
  );

  // Get all PO line items for POs in Delivered to Delivery Bay status
  const deliveredPOItems = useMemo(() => {
    const deliveredPOs = purchaseOrders.filter(
      po => po.status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY
    );
    
    const items = [];
    for (const po of deliveredPOs) {
      const poLines = purchaseOrderLines.filter(line => line.purchase_order_id === po.id);
      for (const line of poLines) {
        items.push({
          id: line.id,
          po_id: po.id,
          po_number: po.po_number,
          supplier_name: po.supplier_name,
          item_name: line.item_name || line.description,
          quantity: line.qty_ordered || 0,
          expected_date: po.expected_date,
        });
      }
    }
    return items;
  }, [purchaseOrders, purchaseOrderLines]);
  const logisticsJobGroups = useMemo(
    () => getLogisticsJobs(jobs),
    [jobs]
  );

  // Kanban columns based on PO status
  const draftPOs = useMemo(
    () => purchaseOrders.filter((po) => po.status === PO_STATUS.DRAFT),
    [purchaseOrders]
  );

  const activePOs = useMemo(
    () => purchaseOrders.filter(po =>
      po.status !== PO_STATUS.DRAFT &&
      po.status !== PO_STATUS.IN_STORAGE &&
      po.status !== PO_STATUS.IN_VEHICLE &&
      po.status !== PO_STATUS.INSTALLED &&
      po.status !== PO_STATUS.COMPLETED_IN_STORAGE &&
      po.status !== PO_STATUS.COMPLETED_IN_VEHICLE
    ),
    [purchaseOrders]
  );

  const onOrderPOs = useMemo(
    () => purchaseOrders.filter(po =>
      [PO_STATUS.SENT, PO_STATUS.ON_ORDER, PO_STATUS.IN_TRANSIT].includes(po.status)
    ),
    [purchaseOrders]
  );

  const readyAtSupplierPOs = useMemo(
    () => purchaseOrders.filter(po =>
      [PO_STATUS.READY_TO_PICK_UP].includes(po.status)
    ),
    [purchaseOrders]
  );

  const atDeliveryBayPOs = useMemo(
    () => purchaseOrders.filter(po =>
      [PO_STATUS.DELIVERED_LOADING_BAY, PO_STATUS.DELIVERED_TO_DELIVERY_BAY].includes(po.status)
    ),
    [purchaseOrders]
  );

  const deliveredPickedUpPOs = useMemo(
    () =>
      purchaseOrders.filter(
        (po) =>
          po.status === PO_STATUS.DELIVERED ||
          po.status === PO_STATUS.READY_TO_PICK_UP ||
          po.status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY
      ),
    [purchaseOrders]
  );

  const completedPOs = useMemo(
    () =>
      purchaseOrders.filter(
        (po) =>
          po.status === PO_STATUS.IN_STORAGE ||
          po.status === PO_STATUS.IN_VEHICLE ||
          po.status === PO_STATUS.INSTALLED ||
          po.status === PO_STATUS.COMPLETED_IN_STORAGE ||
          po.status === PO_STATUS.COMPLETED_IN_VEHICLE
      ),
    [purchaseOrders]
  );

  const loadingBayPOCount = useMemo(() => {
    const poIds = new Set(
      loadingBayParts
        .map((part) => part.purchase_order_id)
        .filter(Boolean)
    );
    return poIds.size;
  }, [loadingBayParts]);

  const openLogisticsJobsCount = useMemo(() => {
    const open = [
      ...(logisticsJobGroups.open || []),
      ...(logisticsJobGroups.scheduled || []),
      ...(logisticsJobGroups.in_progress || []),
    ];
    return open.length;
  }, [logisticsJobGroups]);

  const handleUpdatePoStatus = async (po, newStatus) => {
    if (newStatus === po.status) return;

    try {
      const response = await base44.functions.invoke("managePurchaseOrder", {
        action: "updateStatus",
        id: po.id,
        status: newStatus,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to update PO status");
        return;
      }

      toast.success(`Status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    } catch (error) {
      toast.error("Error updating PO status");
    }
  };

  const getRelevantTradesForJob = useCallback((job, trades) => {
    return (trades || []).filter((t) => {
      if (!t.is_required) return false;
      const appliesToAll = t.applies_to_all_jobs !== false;
      if (appliesToAll) return true;
      const types = t.applies_to_job_types || [];
      if (!job?.job_type_name) return false;
      return types.includes(job.job_type_name);
    });
  }, []);

  const vehicleMap = useMemo(
    () =>
      vehicles.reduce((acc, v) => {
        acc[v.id] = v;
        return acc;
      }, {}),
    [vehicles]
  );

  const inventoryByItem = useMemo(() => {
    const map = {};
    // Warehouse from PriceList
    for (const item of priceListItems) {
      map[item.id] = (map[item.id] || 0) + (item.stock_level || 0);
    }
    // Vehicles from InventoryQuantity
    for (const iq of inventoryQuantities) {
      if (iq.price_list_item_id && iq.location_type === "vehicle") {
        map[iq.price_list_item_id] =
          (map[iq.price_list_item_id] || 0) + (iq.quantity_on_hand || 0);
      }
    }
    return map;
  }, [priceListItems, inventoryQuantities]);

  const detectShortage = useCallback(
    (part) => {
      if (
        [
          "Ordered",
          "Back-ordered",
          "Delivered",
          "At Supplier",
          "At Delivery Bay",
          "In Warehouse Storage",
          "With Technician",
          "At Client Site",
        ].includes(part.status)
      ) {
        return false;
      }
      if (part.status === "Cancelled") return false;

      const requiredQty = part.quantity_required || 1;
      if (part.price_list_item_id) {
        const availableQty = inventoryByItem[part.price_list_item_id] || 0;
        return availableQty < requiredQty;
      }
      return true;
    },
    [inventoryByItem]
  );

  const projectMap = useMemo(
    () =>
      projects.reduce(
        (acc, p) => ({ ...acc, [p.id]: p }),
        {}
      ),
    [projects]
  );

  const jobMap = useMemo(
    () =>
      jobs.reduce(
        (acc, j) => ({ ...acc, [j.id]: j }),
        {}
      ),
    [jobs]
  );

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Part.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("Part updated successfully");
    },
    onError: () => toast.error("Failed to update part"),
  });

  const movePartMutation = useMutation({
    mutationFn: ({ part_ids, from_location, to_location }) =>
      base44.functions.invoke("recordStockMovement", {
        part_ids,
        from_location,
        to_location,
      }),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: ["parts"] });
        toast.success("Part moved successfully");
      } else {
        toast.error(response.data?.error || "Failed to move part");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to move part");
    },
  });

  const handleCreateLogisticsJobForPO = async (po) => {
    try {
      const response = await base44.functions.invoke("createLogisticsJobForPO", {
        purchase_order_id: po.id,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to create logistics job");
        return;
      }

      toast.success("Logistics job created");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    } catch (error) {
      toast.error("Error creating logistics job");
    }
  };

  const handleMoveLoadingBayPart = async (part, destination) => {
    try {
      const response = await base44.functions.invoke("recordStockMovement", {
        part_ids: [part.id],
        from_location: LOGISTICS_LOCATION.LOADING_BAY,
        to_location: destination,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to move part");
        return;
      }

      toast.success(`Part moved to ${destination}`);
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    } catch (error) {
      toast.error("Error moving part");
    }
  };

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Logistics job updated");
    },
    onError: () => toast.error("Failed to update job"),
  });

  const handleStatusChange = useCallback(
    (partId, newStatus) => {
      updatePartMutation.mutate({ id: partId, data: { status: newStatus } });
    },
    [updatePartMutation]
  );

  const handleLocationChange = useCallback(
    (partId, newLocation) => {
      const part = parts.find((p) => p.id === partId);
      if (!part) return;

      const fromLocation = part.location || "Supplier";
      movePartMutation.mutate({
        part_ids: [partId],
        from_location: fromLocation,
        to_location: newLocation,
      });
    },
    [parts, movePartMutation]
  );

  const filteredParts = useMemo(() => {
    return parts
      .filter((part) => {
        const searchLower = debouncedSearchTerm.toLowerCase();
        const project = projectMap[part.project_id];
        const matchesSearch =
          part.category?.toLowerCase().includes(searchLower) ||
          part.supplier_name?.toLowerCase().includes(searchLower) ||
          part.order_reference?.toLowerCase().includes(searchLower) ||
          project?.title?.toLowerCase().includes(searchLower) ||
          project?.customer_name?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;

        if (statusFilter === "active") {
          if (["Delivered", "Cancelled", "Returned"].includes(part.status))
            return false;
        } else if (statusFilter !== "all") {
          if (part.status !== statusFilter) return false;
        }

        if (locationFilter !== "all" && part.location !== locationFilter)
          return false;

        if (vehicleFilter !== "all") {
          if (part.assigned_vehicle_id !== vehicleFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.order_date || a.created_date;
        const dateB = b.order_date || b.created_date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [
    parts,
    debouncedSearchTerm,
    statusFilter,
    locationFilter,
    vehicleFilter,
    projectMap,
  ]);

  const filteredStockJobs = useMemo(
    () =>
      stockLogisticsJobs.filter((job) => {
        if (!job.project_id) return true;
        const relevantTrades = getRelevantTradesForJob(
          job,
          tradesByProjectId[job.project_id]
        );
        const hasRequiredTrades = relevantTrades.length > 0;
        if (showOnlyThirdParty && !hasRequiredTrades) return false;
        return true;
      }),
    [stockLogisticsJobs, showOnlyThirdParty, tradesByProjectId, getRelevantTradesForJob]
  );

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        {/* Summary Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">
              Logistics
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Track purchase orders, logistics jobs, and parts movement
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("orders")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === "orders"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => setViewMode("jobs")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === "jobs"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Logistics Jobs
              </button>
            </div>
            <Button
              onClick={async () => {
                try {
                  const response = await base44.functions.invoke(
                    "managePurchaseOrder",
                    {
                      action: "create",
                      supplier_id: suppliers[0]?.id || "temp",
                      line_items: [{ name: "New Item", qty: 1, price: 0 }],
                    }
                  );

                  if (response.data?.success && response.data?.purchaseOrder) {
                    const newPO = response.data.purchaseOrder;
                    navigate(
                      `${createPageUrl("PurchaseOrders")}?poId=${newPO.id}`
                    );
                    toast.success("Draft Purchase Order created");
                  } else {
                    toast.error("Failed to create PO");
                  }
                } catch (error) {
                  console.error("Error creating PO:", error);
                  toast.error("Failed to create Purchase Order");
                }
              }}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition h-9 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="border border-gray-200">
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Draft POs</p>
              <p className="text-xl font-semibold text-gray-900">{draftPOs.length}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Active POs</p>
              <p className="text-xl font-semibold text-gray-900">{activePOs.length}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Items in Loading Bay</p>
              <p className="text-xl font-semibold text-gray-900">{loadingBayParts.length}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="py-3">
              <p className="text-xs text-gray-500">Open Logistics Jobs</p>
              <p className="text-xl font-semibold text-gray-900">{openLogisticsJobsCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders View */}
        {viewMode === "orders" && (
          <>
            {/* Purchase Orders Kanban Board */}
            <section className="mb-6">
              <div className="grid gap-4 md:grid-cols-5">
                {/* Column: Draft */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      Draft
                    </span>
                    <span className="text-xs text-[#6B7280]">{draftPOs.length}</span>
                  </div>
                  <div className="space-y-2">
                    {draftPOs.map((po) => (
                      <div
                        key={po.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          {po.po_number || `PO #${po.id.substring(0, 8)}`}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {po.supplier_name || "Supplier not set"}
                        </div>
                        {po.expected_date && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(po.expected_date), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {po.delivery_method && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {po.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {po.linked_logistics_job_id && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={po.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectTrigger className="h-6 w-full text-[10px] px-2 border-0 bg-slate-100 text-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.filter((status) => {
                                if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) return false;
                                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) return false;
                                return true;
                              }).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    {!draftPOs.length && (
                      <div className="text-[11px] text-[#6B7280] text-center py-4">
                        No POs
                      </div>
                    )}
                  </div>
                </div>

                {/* Column: On Order / In Transit */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      On Order / In Transit
                    </span>
                    <span className="text-xs text-[#6B7280]">{onOrderPOs.length}</span>
                  </div>
                  <div className="space-y-2">
                    {onOrderPOs.map((po) => (
                      <div
                        key={po.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          {po.po_number || `PO #${po.id.substring(0, 8)}`}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {po.supplier_name || "Supplier not set"}
                        </div>
                        {po.expected_date && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(po.expected_date), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {po.delivery_method && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {po.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {po.linked_logistics_job_id && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={po.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectTrigger className={`h-6 w-full text-[10px] px-2 border-0 ${po.status === PO_STATUS.ON_ORDER ? 'bg-blue-100 text-blue-700' : po.status === PO_STATUS.IN_TRANSIT ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.filter((status) => {
                                if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) return false;
                                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) return false;
                                return true;
                              }).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    {!onOrderPOs.length && (
                      <div className="text-[11px] text-[#6B7280] text-center py-4">
                        No POs
                      </div>
                    )}
                  </div>
                </div>

                {/* Column: At Supplier (Ready for Pickup) */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      At Supplier
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      {readyAtSupplierPOs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {readyAtSupplierPOs.map((po) => (
                      <div
                        key={po.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          {po.po_number || `PO #${po.id.substring(0, 8)}`}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {po.supplier_name || "Supplier not set"}
                        </div>
                        {po.expected_date && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(po.expected_date), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {po.delivery_method && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {po.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {po.linked_logistics_job_id && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={po.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectTrigger className="h-6 w-full text-[10px] px-2 border-0 bg-amber-100 text-amber-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.filter((status) => {
                                if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) return false;
                                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) return false;
                                return true;
                              }).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    {!readyAtSupplierPOs.length && (
                      <div className="text-[11px] text-[#6B7280] text-center py-4">
                        No POs
                      </div>
                    )}
                  </div>
                </div>

                {/* Column: At Delivery Bay */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      At Delivery Bay
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      {atDeliveryBayPOs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {atDeliveryBayPOs.map((po) => (
                      <div
                        key={po.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          {po.po_number || `PO #${po.id.substring(0, 8)}`}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {po.supplier_name || "Supplier not set"}
                        </div>
                        {po.expected_date && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(po.expected_date), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {po.delivery_method && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {po.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {po.linked_logistics_job_id && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={po.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectTrigger className="h-6 w-full text-[10px] px-2 border-0 bg-cyan-100 text-cyan-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.filter((status) => {
                                if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) return false;
                                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) return false;
                                return true;
                              }).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    {!atDeliveryBayPOs.length && (
                      <div className="text-[11px] text-[#6B7280] text-center py-4">
                        No POs
                      </div>
                    )}
                  </div>
                </div>

                {/* Column: Completed */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      Completed
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      {completedPOs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {completedPOs.map((po) => (
                      <div
                        key={po.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          {po.po_number || `PO #${po.id.substring(0, 8)}`}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {po.supplier_name || "Supplier not set"}
                        </div>
                        {po.expected_date && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(po.expected_date), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {po.delivery_method && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {po.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {po.linked_logistics_job_id && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={po.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectTrigger className={`h-6 w-full text-[10px] px-2 border-0 ${po.status === PO_STATUS.IN_STORAGE || po.status === PO_STATUS.COMPLETED_IN_STORAGE ? 'bg-emerald-100 text-emerald-700' : po.status === PO_STATUS.IN_VEHICLE || po.status === PO_STATUS.COMPLETED_IN_VEHICLE ? 'bg-teal-100 text-teal-700' : 'bg-green-100 text-green-700'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.filter((status) => {
                                if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) return false;
                                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) return false;
                                return true;
                              }).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    {!completedPOs.length && (
                      <div className="text-[11px] text-[#6B7280] text-center py-4">
                        No POs
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

                {/* Loading Bay */}
                <section className="mb-6">
                <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-base">Loading Bay</CardTitle>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {loadingBayParts.length} items from {loadingBayPOCount} POs
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliveredPOItems.length === 0 && loadingBayParts.length === 0 ? (
                  <div className="text-sm text-[#6B7280]">
                    No items in Loading Bay.
                  </div>
                ) : (
                  <>
                    {/* PO Items */}
                    {deliveredPOItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[#6B7280] uppercase">
                          Purchase Orders
                        </div>
                        {deliveredPOItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col rounded-md border px-3 py-2 cursor-pointer hover:bg-[#F3F4F6] transition-colors"
                            onClick={() => setSelectedPoId(item.po_id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {item.item_name}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                Qty: {item.quantity}
                              </span>
                            </div>
                            <div className="text-xs text-[#6B7280] mt-1">
                              PO: {item.po_number || `#${item.po_id.substring(0, 8)}`} • {item.supplier_name}
                            </div>
                            {item.expected_date && (
                              <div className="text-xs text-[#6B7280] mt-0.5">
                                ETA: {format(new Date(item.expected_date), "MMM d")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Legacy Parts (if any) */}
                    {loadingBayParts.length > 0 && (
                      <div className="space-y-2">
                        {deliveredPOItems.length > 0 && (
                          <div className="text-xs font-semibold text-[#6B7280] uppercase mt-4">
                            Project Parts
                          </div>
                        )}
                        {loadingBayParts.map((part) => (
                          <div
                            key={part.id}
                            className="flex flex-col rounded-md border px-3 py-2 cursor-pointer hover:bg-[#F3F4F6] transition-colors"
                            onClick={() => setSelectedPart(part)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {part.category || "Part"}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                Qty: {part.quantity_required || part.quantity || 1}
                              </span>
                            </div>
                            <div className="text-xs text-[#6B7280] mt-1">
                              {(() => {
                                const proj = projects.find(
                                  (p) => p.id === part.project_id
                                );
                                return proj
                                  ? proj.title
                                  : part.project_id
                                  ? `Project ${part.project_id.substring(0, 8)}`
                                  : "No project";
                              })()}
                            </div>
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveLoadingBayPart(
                                      part,
                                      LOGISTICS_LOCATION.STORAGE
                                    );
                                  }}
                                >
                                  To Storage
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveLoadingBayPart(
                                      part,
                                      LOGISTICS_LOCATION.VEHICLE
                                    );
                                  }}
                                >
                                  To Vehicle
                                </Button>
                              </div>
                              {part.purchase_order_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] w-full"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const response = await base44.functions.invoke("createLogisticsJobForPO", {
                                        purchase_order_id: part.purchase_order_id,
                                      });
                                      if (!response.data?.success) {
                                        toast.error(response.data?.error || "Failed to create logistics job");
                                        return;
                                      }
                                      toast.success("Logistics job created");
                                      queryClient.invalidateQueries({ queryKey: ['jobs'] });
                                      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
                                    } catch (error) {
                                      toast.error("Error creating logistics job");
                                    }
                                  }}
                                >
                                  Create Pickup Job
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                  </CardContent>
                  </Card>
                  </section>


            {/* Advanced Parts View - Collapsible */}
            <div className="mt-8">
              <Button
                variant="ghost"
                size="sm"
                className="mb-2"
                onClick={() => setShowAdvancedParts((v) => !v)}
              >
                {showAdvancedParts ? "Hide advanced parts view" : "Show advanced parts view"}
              </Button>

              {showAdvancedParts && (
                <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <h3 className="text-base font-semibold text-[#111827]">All Parts (Advanced)</h3>
                    <p className="text-xs text-[#6B7280] mt-1">Filtered view of all parts for detailed management</p>
                  </div>
                  <div className="p-4">
                    {/* Existing filters and parts table would go here if there was one */}
                    <div className="text-sm text-[#6B7280] text-center py-8">
                      Advanced parts filtering and table view (legacy view)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Logistics Jobs View */}
        {viewMode === "jobs" && (
          <section>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Column: Open/Scheduled */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Open / Scheduled</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ...(logisticsJobGroups.open || []),
                    ...(logisticsJobGroups.scheduled || []),
                  ].length === 0 ? (
                    <div className="text-sm text-[#6B7280]">
                      No open logistics jobs.
                    </div>
                  ) : (
                    [
                      ...(logisticsJobGroups.open || []),
                      ...(logisticsJobGroups.scheduled || []),
                    ].map((job) => {
                      const po = purchaseOrders.find(p => p.id === job.purchase_order_id);
                      const supplier = suppliers.find(s => s.id === po?.supplier_id);
                      return (
                        <div
                          key={job.id}
                          className="flex flex-col rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                          onClick={() =>
                            navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {supplier?.name || po?.supplier_name || "Supplier"}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <Badge variant="outline" className="text-xs h-5">
                              {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                            </Badge>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : "866 Bourke Street, Waterloo"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Column: In Progress */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">In Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(logisticsJobGroups.in_progress || []).length === 0 ? (
                    <div className="text-sm text-[#6B7280]">
                      No jobs in progress.
                    </div>
                  ) : (
                    (logisticsJobGroups.in_progress || []).map((job) => {
                      const po = purchaseOrders.find(p => p.id === job.purchase_order_id);
                      const supplier = suppliers.find(s => s.id === po?.supplier_id);
                      return (
                        <div
                          key={job.id}
                          className="flex flex-col rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                          onClick={() =>
                            navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {supplier?.name || po?.supplier_name || "Supplier"}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <Badge variant="outline" className="text-xs h-5">
                              {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                            </Badge>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : "866 Bourke Street, Waterloo"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Column: Completed */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Completed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(logisticsJobGroups.completed || []).length === 0 ? (
                    <div className="text-sm text-[#6B7280]">
                      No recently completed logistics jobs.
                    </div>
                  ) : (
                    (logisticsJobGroups.completed || []).map((job) => {
                      const po = purchaseOrders.find(p => p.id === job.purchase_order_id);
                      const supplier = suppliers.find(s => s.id === po?.supplier_id);
                      return (
                        <div
                          key={job.id}
                          className="flex flex-col rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                          onClick={() =>
                            navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {supplier?.name || po?.supplier_name || "Supplier"}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <Badge variant="outline" className="text-xs h-5">
                              {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                            </Badge>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : "866 Bourke Street, Waterloo"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </div>

      {/* PO Detail Modal */}
      {selectedPoId && (
        <Dialog open={!!selectedPoId} onOpenChange={(open) => !open && setSelectedPoId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
            <PurchaseOrderDetail
              poId={selectedPoId}
              onClose={() => setSelectedPoId(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}