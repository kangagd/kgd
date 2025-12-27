import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { sameId } from "@/components/utils/id";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as purchaseOrdersApi from "@/components/api/purchaseOrdersApi";
import { isLegacyPurchasingReadOnly } from "@/components/config/featureFlags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Truck, MapPin, AlertCircle, Link as LinkIcon, Plus, Briefcase, ExternalLink, TestTube2 } from "lucide-react";
import PurchaseOrderModal from "../components/logistics/PurchaseOrderModal";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import PartDetailModal from "../components/projects/PartDetailModal";
import { toast } from "sonner";

import BackButton from "../components/common/BackButton";
import StatusBadge from "../components/common/StatusBadge";
import QueryState from "../components/system/QueryState";
import {
  getIncomingPurchaseOrders,
  getLoadingBayParts,
  getLogisticsJobs,
} from "@/components/domain/logisticsViewHelpers";
import { LOGISTICS_LOCATION } from "@/components/domain/logisticsConfig";
import { PO_STATUS, PO_STATUS_OPTIONS, normaliseLegacyPoStatus } from "@/components/domain/purchaseOrderStatusConfig";
import { getStatusLabel, getStatusColor } from "@/components/domain/statusRegistry";
import { invalidatePurchaseOrderBundle } from "@/components/api/invalidate";
import { poDbToUi, getPoDisplaySupplierName } from "@/components/domain/purchaseOrderAdapter";
import { DELIVERY_METHOD as PO_DELIVERY_METHOD } from "@/components/domain/supplierDeliveryConfig";
import { PART_LOCATION } from "@/components/domain/partConfig";
import { getPoDisplayReference } from "@/components/domain/poDisplayHelpers";





export default function Logistics() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState("orders"); // "orders" | "jobs"
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState("active"); // active, all, or specific status
  const [locationFilter, setLocationFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedPart, setSelectedPart] = useState(null);
  const [showOnlyThirdParty, setShowOnlyThirdParty] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [showAdvancedParts, setShowAdvancedParts] = useState(false);

  const isOrdersView = viewMode === "orders";
  const isJobsView = viewMode === "jobs";

  // Fetch Data - with caching and conditional loading
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("name"),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  // Only load when orders view and loading bay has items
  const hasLoadingBayPOs = useMemo(() => {
    return purchaseOrders.some(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized === PO_STATUS.IN_LOADING_BAY;
    });
  }, [purchaseOrders]);

  const { data: purchaseOrderLines = [] } = useQuery({
    queryKey: ["purchaseOrderLines"],
    queryFn: () => base44.entities.PurchaseOrderLine.list(),
    enabled: isOrdersView && hasLoadingBayPOs,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list(),
    enabled: isOrdersView || showAdvancedParts,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list(),
    enabled: isOrdersView && showAdvancedParts,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list(),
    enabled: isJobsView,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: stockLogisticsJobs = [] } = useQuery({
    queryKey: ["stockLogisticsJobs"],
    queryFn: () =>
      base44.entities.Job.filter({
        purchase_order_id: { $ne: null },
      }),
    enabled: isJobsView,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ["priceListItems-for-logistics"],
    queryFn: () => base44.entities.PriceListItem.list("item"),
    enabled: showAdvancedParts,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-logistics"],
    queryFn: () => base44.entities.Vehicle.list("name"),
    enabled: showAdvancedParts,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ["inventoryQuantities"],
    queryFn: () => base44.entities.InventoryQuantity.list(),
    enabled: showAdvancedParts,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ["allTradeRequirements"],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
    enabled: isJobsView,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
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

  // Get all PO line items for POs in Loading Bay status
  const deliveredPOItems = useMemo(() => {
    const deliveredPOs = purchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized === PO_STATUS.IN_LOADING_BAY && po.delivery_method === PO_DELIVERY_METHOD.DELIVERY;
    });
    
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

  // Filter purchase orders by search term
  const filteredPurchaseOrders = useMemo(() => {
    if (!poSearchTerm.trim()) return purchaseOrders;
    
    const term = poSearchTerm.toLowerCase();
    return purchaseOrders.filter(po => {
      const uiPo = poDbToUi(po);
      const supplierName = getPoDisplaySupplierName(po, suppliers).toLowerCase();
      const poRef = uiPo.poReference.toLowerCase();
      const poName = (uiPo.name || '').toLowerCase();
      
      // Get linked job/project info
      const linkedJob = jobs.find(j => sameId(j.id, po.linked_logistics_job_id));
      const jobNumber = linkedJob?.job_number?.toLowerCase() || '';
      const customerName = (po.project_id ? projects.find(p => sameId(p.id, po.project_id))?.customer_name : linkedJob?.customer_name || '').toLowerCase();
      const address = (linkedJob?.address_full || '').toLowerCase();
      
      return supplierName.includes(term) || 
             poRef.includes(term) || 
             poName.includes(term) ||
             jobNumber.includes(term) ||
             customerName.includes(term) ||
             address.includes(term);
    });
  }, [purchaseOrders, poSearchTerm, suppliers, jobs, projects]);

  // Kanban columns based on PO status
  const draftPOs = useMemo(
    () => filteredPurchaseOrders.filter((po) => po.status === PO_STATUS.DRAFT),
    [filteredPurchaseOrders]
  );

  const activePOs = useMemo(
    () => filteredPurchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized !== PO_STATUS.DRAFT &&
        normalized !== PO_STATUS.IN_STORAGE &&
        normalized !== PO_STATUS.IN_VEHICLE &&
        normalized !== PO_STATUS.INSTALLED;
    }),
    [filteredPurchaseOrders]
  );

  const onOrderPOs = useMemo(
    () => filteredPurchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return [PO_STATUS.SENT, PO_STATUS.ON_ORDER, PO_STATUS.IN_TRANSIT].includes(normalized);
    }),
    [filteredPurchaseOrders]
  );

  const readyAtSupplierPOs = useMemo(
    () => filteredPurchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized === PO_STATUS.IN_LOADING_BAY && po.delivery_method === PO_DELIVERY_METHOD.PICKUP;
    }),
    [filteredPurchaseOrders]
  );

  const atDeliveryBayPOs = useMemo(
    () => filteredPurchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized === PO_STATUS.IN_LOADING_BAY && po.delivery_method === PO_DELIVERY_METHOD.DELIVERY;
    }),
    [filteredPurchaseOrders]
  );

  const completedPOs = useMemo(
    () => filteredPurchaseOrders.filter(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return [PO_STATUS.IN_STORAGE, PO_STATUS.IN_VEHICLE, PO_STATUS.INSTALLED].includes(normalized);
    }),
    [filteredPurchaseOrders]
  );

  const loadingBaySummary = useMemo(() => {
    let totalItems = 0;
    const poIds = new Set();

    // Count items and POs from deliveredPOItems
    for (const item of deliveredPOItems) {
      totalItems += item.quantity || 0;
      if (item.po_id) poIds.add(item.po_id);
    }

    // Count items and POs from loadingBayParts
    for (const part of loadingBayParts) {
      totalItems += part.quantity_required || 1;
      if (part.purchase_order_id) poIds.add(part.purchase_order_id);
    }

    return {
      totalItems,
      totalPOs: poIds.size,
    };
  }, [deliveredPOItems, loadingBayParts]);

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
      const updatedPO = await purchaseOrdersApi.updateStatus({
        id: po.id,
        status: newStatus
      });
      
      // Optimistically update cache
      queryClient.setQueryData(['purchaseOrders'], (prev = []) => {
        const next = [...prev];
        const idx = next.findIndex(p => sameId(p.id, po.id));
        if (idx >= 0) next[idx] = updatedPO;
        return next;
      });

      toast.success(`Status updated to ${getStatusLabel('po', newStatus)}`);
      
      // Invalidate all PO-related caches
      await Promise.all([
        invalidatePurchaseOrderBundle(queryClient, po.id),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrder', po.id] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        updatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', updatedPO.project_id] }),
        updatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPOLines', updatedPO.project_id] }),
        queryClient.invalidateQueries({ queryKey: ['parts'] })
      ].filter(Boolean));
    } catch (error) {
      toast.error(error.message || "Error updating PO status");
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
    if (isLegacyPurchasingReadOnly()) {
      toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
      console.warn('[LEGACY_READONLY_BLOCKED]', {
        component: 'Logistics',
        action: 'createLogisticsJobForPO',
        payload: { purchase_order_id: po.id }
      });
      return;
    }
    
    try {
      const response = await base44.functions.invoke("createLogisticsJobForPO", {
        purchase_order_id: po.id,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to create logistics job");
        return;
      }

      toast.success("Logistics job created");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        invalidatePurchaseOrderBundle(queryClient, po.id)
      ]);
    } catch (error) {
      toast.error("Error creating logistics job");
    }
  };

  const handleMoveLoadingBayPart = async (part, destination) => {
    if (isLegacyPurchasingReadOnly()) {
      toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
      console.warn('[LEGACY_READONLY_BLOCKED]', {
        component: 'Logistics',
        action: 'moveLoadingBayPart',
        payload: { part_id: part.id, destination }
      });
      return;
    }
    
    try {
      const response = await base44.functions.invoke("recordStockMovement", {
        part_ids: [part.id],
        from_location: PART_LOCATION.LOADING_BAY,
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
          const normalized = part.status?.toLowerCase().replace(/\s+/g, "_");
          if (["installed", "cancelled"].includes(normalized))
            return false;
        } else if (statusFilter !== "all") {
          if (part.status !== statusFilter) return false;
        }

        if (locationFilter !== "all" && part.location !== locationFilter)
          return false;

        if (vehicleFilter !== "all") {
          if (!sameId(part.assigned_vehicle_id, vehicleFilter)) return false;
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
            {isLegacyPurchasingReadOnly() && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Legacy purchasing is read-only. Use Purchasing V2.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewMode === "orders" && (
              <Input
                placeholder="Search POs, suppliers, jobs..."
                value={poSearchTerm}
                onChange={(e) => setPoSearchTerm(e.target.value)}
                className="w-64"
              />
            )}
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
                // Validate supplier exists
                if (!suppliers || suppliers.length === 0) {
                  toast.error("No suppliers available. Please create a supplier first.");
                  return;
                }

                try {
                  const newPO = await purchaseOrdersApi.createDraft({
                    supplier_id: suppliers[0].id,
                    project_id: null
                  });

                  // Optimistically add to cache
                  queryClient.setQueryData(['purchaseOrders'], (prev = []) => {
                    return [newPO, ...prev];
                  });

                  setSelectedPoId(newPO.id);
                  toast.success("Draft Purchase Order created");

                  // Invalidate caches
                  queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
                } catch (error) {
                  toast.error(error.message || "Failed to create Purchase Order");
                }
              }}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition h-9 px-4 text-sm rounded-xl"
              disabled={isLegacyPurchasingReadOnly()}
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
              <p className="text-xl font-semibold text-gray-900">{loadingBaySummary.totalItems}</p>
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
                   <QueryState isEmpty={draftPOs.length === 0} emptyMessage="No POs">
                    {draftPOs.map((po) => {
                      const uiPo = poDbToUi(po);
                      
                      return (
                      <div
                        key={uiPo.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(uiPo.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          PO #{uiPo.poReference}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {getPoDisplaySupplierName(po, suppliers)}
                        </div>
                        {uiPo.eta && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(uiPo.eta), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {uiPo.deliveryMethod && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {uiPo.deliveryMethod === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {uiPo.linkedLogisticsJobId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={uiPo.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isLegacyPurchasingReadOnly()}
                          >
                            <SelectTrigger className="h-6 w-full text-[10px] px-2 border-0 bg-slate-100 text-slate-700">
                              <SelectValue>
                                {getStatusLabel('po', uiPo.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel('po', status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      );
                    })}
                  </QueryState>
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
                  <QueryState isEmpty={onOrderPOs.length === 0} emptyMessage="No POs">
                    {onOrderPOs.map((po) => {
                      const uiPo = poDbToUi(po);
                      return (
                      <div
                        key={uiPo.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(uiPo.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          PO #{uiPo.poReference}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {getPoDisplaySupplierName(po, suppliers)}
                        </div>
                        {uiPo.eta && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(uiPo.eta), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {uiPo.deliveryMethod && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {uiPo.deliveryMethod === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {uiPo.linkedLogisticsJobId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={uiPo.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isLegacyPurchasingReadOnly()}
                          >
                            <SelectTrigger className={`h-6 w-full text-[10px] px-2 border-0 ${getStatusColor('po', uiPo.status)}`}>
                              <SelectValue>
                                {getStatusLabel('po', uiPo.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel('po', status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      );
                    })}
                  </QueryState>
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
                  <QueryState isEmpty={readyAtSupplierPOs.length === 0} emptyMessage="No POs">
                    {readyAtSupplierPOs.map((po) => {
                      const uiPo = poDbToUi(po);
                      return (
                      <div
                        key={uiPo.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(uiPo.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          PO #{uiPo.poReference}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {getPoDisplaySupplierName(po, suppliers)}
                        </div>
                        {uiPo.eta && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(uiPo.eta), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {uiPo.deliveryMethod && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {uiPo.deliveryMethod === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {uiPo.linkedLogisticsJobId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={uiPo.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isLegacyPurchasingReadOnly()}
                          >
                            <SelectTrigger className={`h-6 w-full text-[10px] px-2 border-0 ${getStatusColor('po', uiPo.status)}`}>
                              <SelectValue>
                                {getStatusLabel('po', uiPo.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel('po', status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      );
                    })}
                  </QueryState>
                  </div>
                </div>

                {/* Column: In Loading Bay */}
                <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      In Loading Bay
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      {atDeliveryBayPOs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                  <QueryState isEmpty={atDeliveryBayPOs.length === 0} emptyMessage="No POs">
                    {atDeliveryBayPOs.map((po) => {
                      const uiPo = poDbToUi(po);
                      return (
                      <div
                        key={uiPo.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(uiPo.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          PO #{uiPo.poReference}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {getPoDisplaySupplierName(po, suppliers)}
                        </div>
                        {uiPo.eta && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(uiPo.eta), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {uiPo.deliveryMethod && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {uiPo.deliveryMethod === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {uiPo.linkedLogisticsJobId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={uiPo.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isLegacyPurchasingReadOnly()}
                          >
                            <SelectTrigger className="h-6 w-full text-[10px] px-2 border-0 bg-cyan-100 text-cyan-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel('po', status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      );
                    })}
                  </QueryState>
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
                  <QueryState isEmpty={completedPOs.length === 0} emptyMessage="No POs">
                    {completedPOs.map((po) => {
                      const uiPo = poDbToUi(po);
                      return (
                      <div
                        key={uiPo.id}
                        className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedPoId(uiPo.id)}
                      >
                        <div className="font-medium text-[#111827] mb-2">
                          PO #{uiPo.poReference}
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B7280]">
                          {getPoDisplaySupplierName(po, suppliers)}
                        </div>
                        {uiPo.eta && (
                          <div className="mt-1 text-[11px] text-[#6B7280]">
                            ETA: {format(new Date(uiPo.eta), "MMM d")}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {uiPo.deliveryMethod && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {uiPo.deliveryMethod === PO_DELIVERY_METHOD.PICKUP ? "Pickup" : "Delivery"}
                            </Badge>
                          )}
                          {uiPo.linkedLogisticsJobId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              Job
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select
                            value={uiPo.status}
                            onValueChange={(value) => handleUpdatePoStatus(po, value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isLegacyPurchasingReadOnly()}
                          >
                            <SelectTrigger className={`h-6 w-full text-[10px] px-2 border-0 ${getStatusColor('po', uiPo.status)}`}>
                              <SelectValue>
                                {getStatusLabel('po', uiPo.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {PO_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {getStatusLabel('po', status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      );
                    })}
                  </QueryState>
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
                    {loadingBaySummary.totalItems} items from {loadingBaySummary.totalPOs} POs
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
                              {(() => {
                                const po = purchaseOrders.find(p => sameId(p.id, item.po_id));
                                const uiPo = poDbToUi(po);
                                return `PO: #${uiPo?.poReference || item.po_id.substring(0, 8)} • ${item.supplier_name}`;
                              })()}
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
                                  (p) => sameId(p.id, part.project_id)
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
                                     PART_LOCATION.WAREHOUSE_STORAGE
                                   );
                                  }}
                                  disabled={isLegacyPurchasingReadOnly()}
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
                                     PART_LOCATION.VEHICLE
                                   );
                                  }}
                                  disabled={isLegacyPurchasingReadOnly()}
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
                                    if (isLegacyPurchasingReadOnly()) {
                                      toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
                                      console.warn('[LEGACY_READONLY_BLOCKED]', {
                                        component: 'Logistics',
                                        action: 'createLogisticsJobForPO',
                                        payload: { purchase_order_id: part.purchase_order_id }
                                      });
                                      return;
                                    }
                                    try {
                                      const response = await base44.functions.invoke("createLogisticsJobForPO", {
                                        purchase_order_id: part.purchase_order_id,
                                      });
                                      if (!response.data?.success) {
                                        toast.error(response.data?.error || "Failed to create logistics job");
                                        return;
                                      }
                                      toast.success("Logistics job created");
                                      await Promise.all([
                                        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
                                        invalidatePurchaseOrderBundle(queryClient, part.purchase_order_id)
                                      ]);
                                    } catch (error) {
                                      toast.error("Error creating logistics job");
                                    }
                                  }}
                                  disabled={isLegacyPurchasingReadOnly()}
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
                      const po = purchaseOrders.find(p => sameId(p.id, job.purchase_order_id));
                      const supplier = suppliers.find(s => sameId(s.id, po?.supplier_id));
                      const isSampleJob = job.job_type_name === "Sample Drop-Off" || job.job_type_name === "Sample Pickup";
                      const hasSamples = job.sample_ids && job.sample_ids.length > 0;
                      
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
                              {isSampleJob ? job.job_type_name : (supplier?.name || po?.supplier_name || "Supplier")}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <div className="flex items-center gap-1">
                              {hasSamples && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-purple-50 text-purple-700 border-purple-200">
                                  <TestTube2 className="w-3 h-3 mr-1" />
                                  Samples
                                </Badge>
                              )}
                              {po && (
                                <Badge variant="outline" className="text-xs h-5">
                                  {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : job.address_full || "866 Bourke Street, Waterloo"}
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
                      const po = purchaseOrders.find(p => sameId(p.id, job.purchase_order_id));
                      const supplier = suppliers.find(s => sameId(s.id, po?.supplier_id));
                      const isSampleJob = job.job_type_name === "Sample Drop-Off" || job.job_type_name === "Sample Pickup";
                      const hasSamples = job.sample_ids && job.sample_ids.length > 0;
                      
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
                              {isSampleJob ? job.job_type_name : (supplier?.name || po?.supplier_name || "Supplier")}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <div className="flex items-center gap-1">
                              {hasSamples && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-purple-50 text-purple-700 border-purple-200">
                                  <TestTube2 className="w-3 h-3 mr-1" />
                                  Samples
                                </Badge>
                              )}
                              {po && (
                                <Badge variant="outline" className="text-xs h-5">
                                  {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : job.address_full || "866 Bourke Street, Waterloo"}
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
                      const po = purchaseOrders.find(p => sameId(p.id, job.purchase_order_id));
                      const supplier = suppliers.find(s => sameId(s.id, po?.supplier_id));
                      const isSampleJob = job.job_type_name === "Sample Drop-Off" || job.job_type_name === "Sample Pickup";
                      const hasSamples = job.sample_ids && job.sample_ids.length > 0;
                      
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
                              {isSampleJob ? job.job_type_name : (supplier?.name || po?.supplier_name || "Supplier")}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-[#6B7280]">
                              {job.scheduled_date
                                ? format(new Date(job.scheduled_date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <div className="flex items-center gap-1">
                              {hasSamples && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-purple-50 text-purple-700 border-purple-200">
                                  <TestTube2 className="w-3 h-3 mr-1" />
                                  Samples
                                </Badge>
                              )}
                              {po && (
                                <Badge variant="outline" className="text-xs h-5">
                                  {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP ? "Pick Up" : "Delivery"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {po?.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                              ? (supplier?.pickup_address || supplier?.address_full || "Supplier address")
                              : job.address_full || "866 Bourke Street, Waterloo"}
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
      <PurchaseOrderModal
        poId={selectedPoId}
        open={!!selectedPoId}
        onClose={() => setSelectedPoId(null)}
      />
    </div>
  );
}