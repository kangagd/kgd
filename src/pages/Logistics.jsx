import React, { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Filter, Truck, Package, MapPin, CheckCircle2, Clock, AlertCircle, Link as LinkIcon, Plus, Briefcase, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import PartDetailModal from "../components/projects/PartDetailModal";
import SupplierPurchaseOrderModal from "../components/purchasing/SupplierPurchaseOrderModal";
import { toast } from "sonner";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";
import { MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";
import BackButton from "../components/common/BackButton";
import StatusBadge from "../components/common/StatusBadge";
import {
  getIncomingPurchaseOrders,
  getLoadingBayParts,
  getLogisticsJobs,
  getLogisticsSummaryStats,
} from "@/components/domain/logisticsViewHelpers";
import { LOGISTICS_LOCATION, PO_STATUS, PO_DELIVERY_METHOD } from "@/components/domain/logisticsConfig";

const STATUS_COLORS = {
  "Pending": "bg-slate-100 text-slate-800 border-slate-200",
  "Ordered": "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Returned": "bg-orange-100 text-orange-800 border-orange-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const LOCATION_COLORS = {
  "On Order": "bg-slate-50 text-slate-600",
  [INVENTORY_LOCATION.SUPPLIER]: "bg-indigo-50 text-indigo-600",
  [INVENTORY_LOCATION.DELIVERY_BAY]: "bg-blue-50 text-blue-600",
  [INVENTORY_LOCATION.WAREHOUSE]: "bg-purple-50 text-purple-600",
  [INVENTORY_LOCATION.WITH_TECHNICIAN]: "bg-amber-50 text-amber-600",
  [INVENTORY_LOCATION.AT_CLIENT_SITE]: "bg-green-50 text-green-600"
};

export default function Logistics() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("orders"); // "orders" | "jobs"
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState("active"); // active, all, specific statuses
  const [locationFilter, setLocationFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedPart, setSelectedPart] = useState(null);
  const [showOnlyThirdParty, setShowOnlyThirdParty] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierSelector, setShowSupplierSelector] = useState(false);
  const [tempSupplierSelection, setTempSupplierSelection] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);
  
  // Board view data
  const [boardPOs, setBoardPOs] = useState([]);
  const [boardJobs, setBoardJobs] = useState([]);
  const [boardParts, setBoardParts] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [draggingPoId, setDraggingPoId] = useState(null);

  // Fetch Data
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ['parts'],
    queryFn: () => base44.entities.Part.list(),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const { data: purchaseOrderLines = [] } = useQuery({
    queryKey: ['purchaseOrderLines'],
    queryFn: () => base44.entities.PurchaseOrderLine.list(),
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: stockLogisticsJobs = [] } = useQuery({
    queryKey: ['stockLogisticsJobs'],
    queryFn: () => base44.entities.Job.filter({
        purchase_order_id: { $ne: null } 
    }),
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems-for-logistics'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-for-logistics'],
    queryFn: () => base44.entities.Vehicle.list('name'),
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ['allTradeRequirements'],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name'),
  });

  // Load data for board view
  useEffect(() => {
    let isCancelled = false;

    async function loadLogisticsBoardData() {
      setLoadingBoard(true);
      try {
        const [poResult, jobResult, partResult] = await Promise.all([
          base44.entities.PurchaseOrder.list('-created_date', 200),
          base44.entities.Job.list('-created_date', 200),
          base44.entities.Part.list('-created_date', 500),
        ]);

        if (!isCancelled) {
          const poList = Array.isArray(poResult) ? poResult : poResult?.data || [];
          const jobList = Array.isArray(jobResult) ? jobResult : jobResult?.data || [];
          const partList = Array.isArray(partResult) ? partResult : partResult?.data || [];

          setBoardPOs(poList);
          setBoardJobs(jobList);
          setBoardParts(partList);
        }
      } catch (error) {
        console.error("Error loading logistics board data", error);
      } finally {
        if (!isCancelled) setLoadingBoard(false);
      }
    }

    loadLogisticsBoardData();

    return () => {
      isCancelled = true;
    };
  }, []);

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

  // Derived board data
  const incomingPOs = useMemo(() => getIncomingPurchaseOrders(boardPOs), [boardPOs]);
  const loadingBayParts = useMemo(() => getLoadingBayParts(boardParts), [boardParts]);
  const logisticsJobGroups = useMemo(() => getLogisticsJobs(boardJobs), [boardJobs]);
  const summaryStats = useMemo(() => getLogisticsSummaryStats(boardPOs, boardJobs, boardParts), [boardPOs, boardJobs, boardParts]);

  // Derive Kanban columns from purchase orders
  const sentPOs = useMemo(() => 
    purchaseOrders.filter((po) => po.status === PO_STATUS.SENT),
    [purchaseOrders]
  );

  const confirmedPOs = useMemo(() =>
    purchaseOrders.filter((po) => 
      po.status === PO_STATUS.CONFIRMED ||
      po.status === PO_STATUS.DELIVERED ||
      po.status === PO_STATUS.READY_TO_PICK_UP
    ),
    [purchaseOrders]
  );

  const deliveryBayPOs = useMemo(() =>
    purchaseOrders.filter((po) => po.status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY),
    [purchaseOrders]
  );

  const completedPOs = useMemo(() =>
    purchaseOrders.filter((po) => 
      po.status === PO_STATUS.COMPLETED_IN_STORAGE ||
      po.status === PO_STATUS.COMPLETED_IN_VEHICLE
    ),
    [purchaseOrders]
  );

  const handleMovePoToLane = async (po, targetLane) => {
    let newStatus = po.status;

    if (targetLane === "sent") {
      newStatus = PO_STATUS.SENT;
    } else if (targetLane === "confirmed") {
      // Determine correct status based on delivery method
      if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY) {
        newStatus = PO_STATUS.DELIVERED;
      } else if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
        newStatus = PO_STATUS.READY_TO_PICK_UP;
      } else {
        newStatus = PO_STATUS.CONFIRMED;
      }
    } else if (targetLane === "delivery_bay") {
      newStatus = PO_STATUS.DELIVERED_TO_DELIVERY_BAY;
    } else if (targetLane === "completed") {
      newStatus = PO_STATUS.COMPLETED_IN_STORAGE;
    }

    if (newStatus === po.status) return;

    try {
      const response = await base44.functions.invoke("managePurchaseOrder", {
        action: "updateStatus",
        id: po.id,
        status: newStatus,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to move PO");
        return;
      }

      const laneNames = {
        sent: "Sent",
        confirmed: "Confirmed",
        delivery_bay: "Delivery Bay",
        completed: "Completed"
      };
      toast.success(`PO moved to ${laneNames[targetLane]}`);
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    } catch (error) {
      toast.error("Error moving PO");
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

  // Maps for quick lookup
  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  const priceListMap = useMemo(() => {
    return priceListItems.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [priceListItems]);

  const inventoryByItem = useMemo(() => {
    const map = {};
    // Warehouse from PriceList
    for (const item of priceListItems) {
      map[item.id] = (map[item.id] || 0) + (item.stock_level || 0);
    }
    // Vehicles from InventoryQuantity
    for (const iq of inventoryQuantities) {
      if (iq.price_list_item_id && iq.location_type === 'vehicle') {
        map[iq.price_list_item_id] = (map[iq.price_list_item_id] || 0) + (iq.quantity_on_hand || 0);
      }
    }
    return map;
  }, [priceListItems, inventoryQuantities]);

  const detectShortage = useCallback((part) => {
    if (['Ordered', 'Back-ordered', 'Delivered', 'At Supplier', 'At Delivery Bay', 'In Warehouse Storage', 'With Technician', 'At Client Site'].includes(part.status)) {
      return false;
    }
    if (part.status === 'Cancelled') return false;
    
    const requiredQty = part.quantity_required || 1;
    if (part.price_list_item_id) {
       const availableQty = inventoryByItem[part.price_list_item_id] || 0;
       return availableQty < requiredQty;
    }
    return true;
  }, [inventoryByItem]);

  const projectMap = useMemo(() => {
    return projects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }, [projects]);

  const jobMap = useMemo(() => {
    return jobs.reduce((acc, j) => ({ ...acc, [j.id]: j }), {});
  }, [jobs]);

  // DEPRECATED: Direct part updates - use recordStockMovement for location changes
  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Part.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success("Part updated successfully");
    },
    onError: () => toast.error("Failed to update part")
  });

  // NEW: Movement mutation using recordStockMovement
  const movePartMutation = useMutation({
    mutationFn: ({ part_ids, from_location, to_location }) => 
      base44.functions.invoke('recordStockMovement', {
        part_ids,
        from_location,
        to_location
      }),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['parts'] });
        toast.success("Part moved successfully");
      } else {
        toast.error(response.data?.error || "Failed to move part");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to move part");
    }
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
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      
      // Reload board data
      const [jobResult] = await Promise.all([
        base44.entities.Job.list('-created_date', 200)
      ]);
      const jobList = Array.isArray(jobResult) ? jobResult : jobResult?.data || [];
      setBoardJobs(jobList);
    } catch (error) {
      toast.error("Error creating logistics job");
    }
  };

  const handleMoveLoadingBayPart = async (part, destination) => {
    try {
      const response = await base44.functions.invoke("recordStockMovement", {
        part_ids: [part.id],
        from_location: LOGISTICS_LOCATION.DELIVERY_BAY,
        to_location: destination,
      });

      if (!response?.data?.success) {
        toast.error(response?.data?.error || "Failed to move part");
        return;
      }

      toast.success(`Part moved to ${destination}`);
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      
      // Reload board data
      const [partResult] = await Promise.all([
        base44.entities.Part.list('-created_date', 500)
      ]);
      const partList = Array.isArray(partResult) ? partResult : partResult?.data || [];
      setBoardParts(partList);
    } catch (error) {
      toast.error("Error moving part");
    }
  };

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("Logistics job updated");
    },
    onError: () => toast.error("Failed to update job"),
  });

  // DEPRECATED: Direct status updates - prefer recordStockMovement for location changes
  const handleStatusChange = useCallback((partId, newStatus) => {
    updatePartMutation.mutate({ id: partId, data: { status: newStatus } });
  }, [updatePartMutation]);

  // UPDATED: Use recordStockMovement for location changes
  const handleLocationChange = useCallback((partId, newLocation) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;
    
    const fromLocation = part.location || "Supplier";
    movePartMutation.mutate({
      part_ids: [partId],
      from_location: fromLocation,
      to_location: newLocation
    });
  }, [parts, movePartMutation]);

  // Filtering - use debounced search to avoid recomputation on every keystroke
  const filteredParts = useMemo(() => {
    return parts.filter(part => {
      // Search
      const searchLower = debouncedSearchTerm.toLowerCase();
      const project = projectMap[part.project_id];
      const matchesSearch = 
        part.category?.toLowerCase().includes(searchLower) ||
        part.supplier_name?.toLowerCase().includes(searchLower) ||
        part.order_reference?.toLowerCase().includes(searchLower) ||
        project?.title?.toLowerCase().includes(searchLower) ||
        project?.customer_name?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === "active") {
        if (["Delivered", "Cancelled", "Returned"].includes(part.status)) return false;
      } else if (statusFilter !== "all") {
        if (part.status !== statusFilter) return false;
      }

      // Location Filter
      if (locationFilter !== "all" && part.location !== locationFilter) return false;

      // Vehicle Filter
      if (vehicleFilter !== "all") {
        if (part.assigned_vehicle_id !== vehicleFilter) return false;
      }

      return true;
    }).sort((a, b) => {
        // Sort by date desc (newest first)
        const dateA = a.order_date || a.created_date;
        const dateB = b.order_date || b.created_date;
        return new Date(dateB) - new Date(dateA);
    });
  }, [parts, debouncedSearchTerm, statusFilter, locationFilter, vehicleFilter, projectMap]);

  const filteredStockJobs = useMemo(() => {
    return stockLogisticsJobs.filter(job => {
      if (!job.project_id) return true;
      const relevantTrades = getRelevantTradesForJob(job, tradesByProjectId[job.project_id]);
      const hasRequiredTrades = relevantTrades.length > 0;
      if (showOnlyThirdParty && !hasRequiredTrades) return false;
      return true;
    });
  }, [stockLogisticsJobs, showOnlyThirdParty, tradesByProjectId]);

  // Stats - Include both Parts and Purchase Order Lines
  const stats = useMemo(() => {
    const activeParts = parts.filter(p => 
      !p.deleted_at && 
      !["Delivered", "Cancelled", "Returned"].includes(p.status)
    );
    const urgentParts = activeParts.filter(p => {
        if (!p.eta) return false;
        return new Date(p.eta) < new Date(); // Overdue
    });
    const atDeliveryBay = activeParts.filter(p => p.location === INVENTORY_LOCATION.DELIVERY_BAY);
    
    // Add active PO lines
    const activePOs = purchaseOrders.filter(po => 
      po.status === 'sent' || po.status === 'partially_received'
    );
    const activePOIds = new Set(activePOs.map(po => po.id));
    const activePOLines = purchaseOrderLines.filter(line => 
      activePOIds.has(line.purchase_order_id) && 
      (line.qty_received || 0) < line.qty_ordered
    );
    
    // Count unreceived items from POs
    const unreceived = activePOLines.reduce((sum, line) => 
      sum + (line.qty_ordered - (line.qty_received || 0)), 0
    );
    
    return {
      totalActive: activeParts.length + unreceived,
      overdue: urgentParts.length,
      readyForPickup: atDeliveryBay.length,
      withTech: activeParts.filter(p => p.location === INVENTORY_LOCATION.WITH_TECHNICIAN).length
    };
  }, [parts, purchaseOrders, purchaseOrderLines]);

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
            <h1 className="text-2xl font-bold text-[#111827]">Delivery & Pickup Board</h1>
            <p className="text-sm text-[#6B7280] mt-1">Track incoming orders, logistics jobs, and parts movement</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="flex flex-col">
              <span className="font-semibold text-lg">{summaryStats.incomingPOCount}</span>
              <span className="text-[#6B7280]">Incoming POs</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg">{summaryStats.logisticsJobCount}</span>
              <span className="text-[#6B7280]">Logistics Jobs</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg">{summaryStats.loadingBayPartCount}</span>
              <span className="text-[#6B7280]">Loading Bay Items</span>
            </div>
          </div>
        </div>

        {/* Purchase Orders Kanban Board */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#111827]">Purchase Orders – Logistics Board</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Column: Sent */}
            <div
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingPoId) return;
                const po = purchaseOrders.find((p) => p.id === draggingPoId);
                if (po) {
                  handleMovePoToLane(po, "sent");
                }
                setDraggingPoId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">Sent</span>
                <span className="text-xs text-[#6B7280]">{sentPOs.length}</span>
              </div>
              <div className="space-y-2">
                {sentPOs.map((po) => (
                  <div
                    key={po.id}
                    className="cursor-grab rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                    draggable
                    onDragStart={() => setDraggingPoId(po.id)}
                    onDragEnd={() => setDraggingPoId(null)}
                    onClick={() => navigate(createPageUrl("PurchaseOrders") + `?poId=${po.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#111827]">
                        {po.po_number || `PO #${po.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      {po.supplier_name || "Supplier not set"}
                    </div>
                  </div>
                ))}
                {!sentPOs.length && (
                  <div className="text-[11px] text-[#6B7280] text-center py-4">
                    No POs
                  </div>
                )}
              </div>
            </div>

            {/* Column: Confirmed */}
            <div
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingPoId) return;
                const po = purchaseOrders.find((p) => p.id === draggingPoId);
                if (po) {
                  handleMovePoToLane(po, "confirmed");
                }
                setDraggingPoId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">Confirmed</span>
                <span className="text-xs text-[#6B7280]">{confirmedPOs.length}</span>
              </div>
              <div className="space-y-2">
                {confirmedPOs.map((po) => (
                  <div
                    key={po.id}
                    className="cursor-grab rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                    draggable
                    onDragStart={() => setDraggingPoId(po.id)}
                    onDragEnd={() => setDraggingPoId(null)}
                    onClick={() => navigate(createPageUrl("PurchaseOrders") + `?poId=${po.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#111827]">
                        {po.po_number || `PO #${po.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      {po.supplier_name || "Supplier not set"}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {po.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {!confirmedPOs.length && (
                  <div className="text-[11px] text-[#6B7280] text-center py-4">
                    No POs
                  </div>
                )}
              </div>
            </div>

            {/* Column: Delivery Bay */}
            <div
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingPoId) return;
                const po = purchaseOrders.find((p) => p.id === draggingPoId);
                if (po) {
                  handleMovePoToLane(po, "delivery_bay");
                }
                setDraggingPoId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">Delivery Bay</span>
                <span className="text-xs text-[#6B7280]">{deliveryBayPOs.length}</span>
              </div>
              <div className="space-y-2">
                {deliveryBayPOs.map((po) => (
                  <div
                    key={po.id}
                    className="cursor-grab rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                    draggable
                    onDragStart={() => setDraggingPoId(po.id)}
                    onDragEnd={() => setDraggingPoId(null)}
                    onClick={() => navigate(createPageUrl("PurchaseOrders") + `?poId=${po.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#111827]">
                        {po.po_number || `PO #${po.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      {po.supplier_name || "Supplier not set"}
                    </div>
                  </div>
                ))}
                {!deliveryBayPOs.length && (
                  <div className="text-[11px] text-[#6B7280] text-center py-4">
                    No POs
                  </div>
                )}
              </div>
            </div>

            {/* Column: Completed */}
            <div
              className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingPoId) return;
                const po = purchaseOrders.find((p) => p.id === draggingPoId);
                if (po) {
                  handleMovePoToLane(po, "completed");
                }
                setDraggingPoId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">Completed</span>
                <span className="text-xs text-[#6B7280]">{completedPOs.length}</span>
              </div>
              <div className="space-y-2">
                {completedPOs.map((po) => (
                  <div
                    key={po.id}
                    className="cursor-grab rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
                    draggable
                    onDragStart={() => setDraggingPoId(po.id)}
                    onDragEnd={() => setDraggingPoId(null)}
                    onClick={() => navigate(createPageUrl("PurchaseOrders") + `?poId=${po.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#111827]">
                        {po.po_number || `PO #${po.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      {po.supplier_name || "Supplier not set"}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {po.status}
                      </Badge>
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

        {/* Board Layout */}
        <section className="mb-8">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Column 1: Incoming POs */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Incoming Purchase Orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingBoard ? (
                  <div className="text-sm text-[#6B7280]">Loading…</div>
                ) : incomingPOs.length === 0 ? (
                  <div className="text-sm text-[#6B7280]">No incoming POs.</div>
                ) : (
                  incomingPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex flex-col rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                      onClick={() => navigate(createPageUrl("PurchaseOrders") + `?poId=${po.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {po.po_number || po.reference || `PO #${po.id.substring(0, 8)}`}
                          </span>
                          <span className="text-xs text-[#6B7280]">
                            {po.supplier_name || "Supplier not set"}
                          </span>
                        </div>
                        <StatusBadge value={po.status} />
                      </div>
                      {!po.linked_logistics_job_id && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateLogisticsJobForPO(po);
                            }}
                          >
                            Create Logistics Job
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Column 2: Logistics Jobs */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Logistics Jobs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {loadingBoard ? (
                  <div className="text-sm text-[#6B7280]">Loading…</div>
                ) : (
                  <>
                    <div>
                      <div className="mb-1 font-medium text-[#111827]">Open / Scheduled</div>
                      <div className="space-y-1">
                        {[
                          ...(logisticsJobGroups.open || []),
                          ...(logisticsJobGroups.scheduled || []),
                        ].map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                            onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                Job #{job.job_number || job.id.substring(0, 8)}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d, yyyy') : "No date"}
                              </span>
                            </div>
                            <StatusBadge value={job.status} />
                          </div>
                        ))}
                        {(!logisticsJobGroups.open?.length && !logisticsJobGroups.scheduled?.length) && (
                          <div className="text-xs text-[#6B7280]">No open logistics jobs.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 font-medium text-[#111827]">In Progress</div>
                      <div className="space-y-1">
                        {(logisticsJobGroups.in_progress || []).map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                            onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                Job #{job.job_number || job.id.substring(0, 8)}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d, yyyy') : "No date"}
                              </span>
                            </div>
                            <StatusBadge value={job.status} />
                          </div>
                        ))}
                        {(!logisticsJobGroups.in_progress?.length) && (
                          <div className="text-xs text-[#6B7280]">No jobs in progress.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 font-medium text-[#111827]">Completed</div>
                      <div className="space-y-1">
                        {(logisticsJobGroups.completed || []).map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                            onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                Job #{job.job_number || job.id.substring(0, 8)}
                              </span>
                              <span className="text-xs text-[#6B7280]">
                                {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d, yyyy') : "No date"}
                              </span>
                            </div>
                            <StatusBadge value={job.status} />
                          </div>
                        ))}
                        {(!logisticsJobGroups.completed?.length) && (
                          <div className="text-xs text-[#6B7280]">No recently completed logistics jobs.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Column 3: Loading Bay Parts */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Loading Bay</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {loadingBoard ? (
                  <div className="text-sm text-[#6B7280]">Loading…</div>
                ) : loadingBayParts.length === 0 ? (
                  <div className="text-sm text-[#6B7280]">No items in Loading Bay.</div>
                ) : (
                  loadingBayParts.map((part) => (
                    <div
                      key={part.id}
                      className="flex flex-col rounded-md border px-3 py-2 cursor-pointer hover:bg-[#F3F4F6] transition-colors"
                      onClick={() => setSelectedPart(part)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{part.category || "Part"}</span>
                        <span className="text-xs text-[#6B7280]">Qty: {part.quantity_required || part.quantity || 1}</span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {(() => {
                          const proj = projects.find(p => p.id === part.project_id);
                          return proj ? proj.title : part.project_id ? `Project ${part.project_id.substring(0, 8)}` : "No project";
                        })()}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveLoadingBayPart(part, LOGISTICS_LOCATION.WAREHOUSE);
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
                            handleMoveLoadingBayPart(part, LOGISTICS_LOCATION.WITH_TECHNICIAN);
                          }}
                        >
                          To Vehicle
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Existing Content Section */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Jobs & Calendar</h2>
              <p className="text-sm text-[#6B7280] mt-1">Manage parts, orders, and locations across all projects</p>
            </div>
            <Button
              onClick={() => {
                setTempSupplierSelection("");
                setShowSupplierSelector(true);
              }}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mt-2 mb-4">
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Active Parts</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.totalActive}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Delivery Bay</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.readyForPickup}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">With Technician</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.withTech}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Overdue ETA</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.overdue}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock & Supplier Logistics Section */}
        {viewMode === "jobs" && stockLogisticsJobs.length > 0 && (
            <Card className="border border-[#E5E7EB] shadow-sm">
                <CardHeader className="bg-gray-50/50 px-6 py-4 border-b border-[#E5E7EB]">
                    <CardTitle className="text-lg font-bold text-[#111827] flex items-center gap-2">
                        <Truck className="w-5 h-5 text-indigo-600" />
                        Stock & Supplier Logistics
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-900">Date</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Supplier</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Type</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Location</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">PO</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Status</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredStockJobs.map(job => {
                                const isStockJob = !!job.purchase_order_id;
                                const isProjectJob = !!job.project_id;
                                
                                const relevantTrades = getRelevantTradesForJob(job, tradesByProjectId[job.project_id]);
                                const hasRequiredTrades = relevantTrades.length > 0;
                                
                                const rowClasses = `transition-colors border-b ${
                                    hasRequiredTrades
                                        ? "bg-amber-50/40 hover:bg-amber-50 border-amber-200"
                                        : isProjectJob 
                                            ? "bg-sky-50/40 hover:bg-sky-50 border-sky-200" 
                                            : isStockJob 
                                                ? "bg-amber-50/40 hover:bg-amber-50 border-amber-200" 
                                                : "hover:bg-gray-50 border-gray-200"
                                }`;

                                const po = job.purchase_order_id ? purchaseOrders.find(p => p.id === job.purchase_order_id) : null;

                                return (
                                <tr 
                                  key={job.id} 
                                  className={rowClasses}
                                >
                                    <td 
                                      className="px-6 py-3 text-gray-700 font-medium cursor-pointer hover:bg-opacity-80"
                                      onClick={() => {
                                        if (po) {
                                          setSelectedPO(po);
                                          setShowPOModal(true);
                                        }
                                      }}
                                    >
                                        {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d, yyyy') : '-'}
                                    </td>
                                    <td 
                                      className="px-6 py-3 text-gray-700 cursor-pointer hover:bg-opacity-80"
                                      onClick={() => {
                                        if (po) {
                                          setSelectedPO(po);
                                          setShowPOModal(true);
                                        }
                                      }}
                                    >
                                        {job.notes?.split(' from ')?.[1]?.split(' –')?.[0] || 'Supplier'}
                                    </td>
                                    <td 
                                      className="px-6 py-3 cursor-pointer hover:bg-opacity-80"
                                      onClick={() => {
                                        if (po) {
                                          setSelectedPO(po);
                                          setShowPOModal(true);
                                        }
                                      }}
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className={
                                                job.job_type_name?.includes('Pickup') 
                                                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                            }>
                                                {job.job_type_name}
                                            </Badge>
                                            {isStockJob && (
                                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                                    PO
                                                </span>
                                            )}
                                            {isProjectJob && (
                                                <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                                                    Project
                                                </span>
                                            )}
                                            {hasRequiredTrades && (
                                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                                    3rd party
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td 
                                      className="px-6 py-3 text-gray-600 cursor-pointer hover:bg-opacity-80"
                                      onClick={() => {
                                        if (po) {
                                          setSelectedPO(po);
                                          setShowPOModal(true);
                                        }
                                      }}
                                    >
                                        {job.address_full || job.address}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600 text-sm font-medium">
                                       {po ? (
                                         <button
                                           type="button"
                                           onClick={() => {
                                             setSelectedPO(po);
                                             setShowPOModal(true);
                                           }}
                                           className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                                         >
                                           {(job.notes?.startsWith('PO ') && job.notes.split(' from ')[0]) || 'View PO'}
                                           <ExternalLink className="w-3 h-3" />
                                         </button>
                                       ) : (
                                         <span className="text-xs text-gray-400">-</span>
                                       )}
                                    </td>
                                    <td className="px-6 py-3">
                                       <Select
                                         value={job.status || "Scheduled"}
                                         onValueChange={(val) => {
                                           updateJobMutation.mutate({ id: job.id, data: { status: val } });
                                         }}
                                       >
                                         <SelectTrigger className="h-8 w-[140px] border-0 bg-white shadow-sm text-xs">
                                           <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="Scheduled">Scheduled</SelectItem>
                                           <SelectItem value="In Progress">In Progress</SelectItem>
                                           <SelectItem value="Completed">Completed</SelectItem>
                                           <SelectItem value="Cancelled">Cancelled</SelectItem>
                                         </SelectContent>
                                       </Select>
                                    </td>
                                    <td className="px-6 py-3">
                                        <Link 
                                          to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                                          title="View Job Details"
                                        >
                                          <Briefcase className="w-4 h-4" />
                                        </Link>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}

        {/* Filters */}
        {viewMode === "orders" && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search by part, project, supplier, or order ref..."
              className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-10 rounded-lg border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
                <SelectItem value="Back-ordered">Back-ordered</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-10 rounded-lg border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827]">
                <SelectValue placeholder="Filter Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {Object.keys(LOCATION_COLORS).map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setShowOnlyThirdParty((v) => !v)}
              className={`rounded-lg border px-3 py-2 h-10 text-xs font-medium transition-all ${
                showOnlyThirdParty
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              3rd party only
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 border border-[#E5E7EB] flex items-center gap-2 px-3 font-normal">
                  <Truck className="w-4 h-4 text-gray-500" />
                  <span className="hidden sm:inline">Vehicle</span>
                  {vehicleFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-[10px] font-normal pointer-events-none">
                      {
                        vehicles.find((v) => v.id === vehicleFilter)?.name
                        || vehicles.find((v) => v.id === vehicleFilter)?.registration
                        || "Selected"
                      }
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="end">
                <div className="space-y-1">
                  <Button
                    variant={vehicleFilter === "all" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start font-normal"
                    onClick={() => setVehicleFilter("all")}
                  >
                    All vehicles
                  </Button>
                  {vehicles.map((v) => (
                    <Button
                      key={v.id}
                      variant={vehicleFilter === v.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start font-normal truncate"
                      onClick={() => setVehicleFilter(v.id)}
                    >
                      {v.name || v.registration || `Vehicle ${v.id}`}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        )}

        {/* Parts Table */}
        {viewMode === "orders" && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900">Part Details</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Project & Customer</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Dates</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Location</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Logistics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partsLoading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                        <p>Loading parts data...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">No parts found</h3>
                        <p className="text-gray-500 text-sm">
                          No parts match your current search filters. Try adjusting your search terms or clearing filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((part) => {
                    const project = projectMap[part.project_id];
                    const linkedJobs = (part.linked_logistics_jobs || []).map(id => jobMap[id]).filter(Boolean);
                    
                    return (
                      <tr key={part.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 align-top">
                          <button 
                            onClick={() => setSelectedPart(part)}
                            className="text-left w-full group/btn"
                          >
                            <div className="font-medium text-gray-900 group-hover/btn:text-blue-600 transition-colors text-base flex items-center gap-2">
                              {part.category}
                              {detectShortage(part) && (
                                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                                  Shortage
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                              <span className="truncate max-w-[200px]">{part.supplier_name || "No Supplier"}</span>
                              {part.order_reference && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                    {part.order_reference}
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {project ? (
                            <Link 
                              to={`${createPageUrl("Projects")}?projectId=${project.id}`}
                              className="block group/link"
                            >
                              <div className="font-medium text-gray-900 group-hover/link:text-blue-600 transition-colors truncate max-w-[200px]">
                                {project.title}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">
                                {project.customer_name}
                              </div>
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned Project</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            {part.order_date && (
                              <div className="text-sm text-gray-600 flex justify-between gap-4">
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Ordered</span>
                                <span className="font-medium">{format(new Date(part.order_date), 'MMM d')}</span>
                              </div>
                            )}
                            {part.eta && (
                              <div className="text-sm flex justify-between gap-4">
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">ETA</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-medium ${
                                    new Date(part.eta) < new Date() && part.status !== 'Delivered' 
                                      ? 'text-red-600' 
                                      : 'text-gray-900'
                                  }`}>
                                    {format(new Date(part.eta), 'MMM d')}
                                  </span>
                                  {new Date(part.eta) < new Date() && part.status !== 'Delivered' && (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                         <Select 
                           value={part.status} 
                           onValueChange={(val) => handleStatusChange(part.id, val)}
                         >
                           <SelectTrigger className={`h-9 border-0 font-medium text-xs w-[140px] ${STATUS_COLORS[part.status] || 'bg-gray-100'} shadow-sm`}>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {Object.keys(STATUS_COLORS).map(status => (
                               <SelectItem key={status} value={status}>
                                 {status}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>

                         {part.status !== "Delivered" && part.status !== "Cancelled" && (
                           <button
                             type="button"
                             onClick={() => {
                               updatePartMutation.mutate({
                                 id: part.id,
                                 data: {
                                   status: "Delivered",
                                   location: part.location || INVENTORY_LOCATION.WAREHOUSE,
                                 },
                               });
                             }}
                             className="mt-1 text-[10px] text-green-700 hover:text-green-800 font-medium"
                           >
                             Mark as received
                           </button>
                         )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Select 
                            value={part.location} 
                            onValueChange={(val) => handleLocationChange(part.id, val)}
                          >
                            <SelectTrigger className={`h-9 border-0 text-xs w-[170px] ${LOCATION_COLORS[part.location] || 'bg-gray-50'} shadow-sm`}>
                              <div className="flex items-center gap-2 truncate">
                                <MapPin className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(LOCATION_COLORS).map(loc => (
                                <SelectItem key={loc} value={loc}>
                                  {loc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {part.location === INVENTORY_LOCATION.WITH_TECHNICIAN && part.assigned_vehicle_id && vehicleMap[part.assigned_vehicle_id] && (
                            <div className="mt-1.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-white border-amber-200 text-amber-700 font-normal whitespace-nowrap overflow-hidden max-w-[170px]">
                                <Truck className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                  {vehicleMap[part.assigned_vehicle_id].name || vehicleMap[part.assigned_vehicle_id].display_name || vehicleMap[part.assigned_vehicle_id].registration_plate || "Vehicle"}
                                </span>
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          {linkedJobs.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {linkedJobs.map(job => (
                                <Link 
                                  key={job.id}
                                  to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                                  className="inline-flex items-center gap-2 text-xs bg-white hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded-md border border-gray-200 transition-all hover:border-blue-300 hover:text-blue-600 w-fit shadow-sm"
                                >
                                  <LinkIcon className="w-3 h-3 opacity-50" />
                                  <span className="font-medium">#{job.job_number}</span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">-</span>
                          )}
                          {part.price_list_item_id && (
                             <button
                               onClick={async () => {
                                 const moves = await base44.entities.StockMovement.filter({ price_list_item_id: part.price_list_item_id });
                                 console.log("Movements for item:", part.price_list_item_id, moves);
                                 toast.info(`Found ${moves.length} movements (check console)`);
                               }}
                               className="mt-2 text-[10px] text-blue-600 hover:underline block"
                             >
                               View Movements
                             </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
        </section>
      </div>

      {/* Part Detail Modal */}
      {selectedPart && (
        <PartDetailModal
          open={!!selectedPart}
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onSave={(data) => {
            updatePartMutation.mutate({ id: selectedPart.id, data });
            setSelectedPart(null);
          }}
          isSubmitting={updatePartMutation.isPending}
        />
      )}

      {/* Supplier Selection Dialog */}
      <Dialog open={showSupplierSelector} onOpenChange={setShowSupplierSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Supplier</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">Choose a supplier for this purchase order</Label>
            <Select value={tempSupplierSelection} onValueChange={setTempSupplierSelection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierSelector(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const supplier = suppliers.find(s => s.id === tempSupplierSelection);
                if (supplier) {
                  setSelectedSupplier(supplier);
                  setShowSupplierSelector(false);
                  setShowPOModal(true);
                }
              }}
              disabled={!tempSupplierSelection}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Order Modal */}
      {showPOModal && (selectedSupplier || selectedPO) && (
        <SupplierPurchaseOrderModal
          open={showPOModal}
          onClose={() => {
            setShowPOModal(false);
            setSelectedSupplier(null);
            setSelectedPO(null);
          }}
          supplier={selectedSupplier || (selectedPO ? suppliers.find(s => s.id === selectedPO.supplier_id) : null)}
          purchaseOrderToEdit={selectedPO}
        />
      )}
    </div>
  );
}