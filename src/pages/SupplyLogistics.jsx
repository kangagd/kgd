import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Truck, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PO_STATUS, normaliseLegacyPoStatus } from "@/components/domain/purchaseOrderStatusConfig";
import { DELIVERY_METHOD as PO_DELIVERY_METHOD } from "@/components/domain/supplierDeliveryConfig";
import { PART_LOCATION, normaliseLegacyPartLocation, PART_STATUS } from "@/components/domain/partConfig";
import PurchaseOrderModal from "../components/logistics/PurchaseOrderModal";
import StatusBadge from "../components/common/StatusBadge";
import BackButton from "../components/common/BackButton";
import { getPoDisplayReference, getPoDisplayTitle } from "@/components/domain/poDisplayHelpers";

export default function SupplyLogistics() {
  const [activeTab, setActiveTab] = useState("board");
  const [activePoId, setActivePoId] = useState(null);
  const navigate = useNavigate();

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name'),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: stockLogisticsJobs = [] } = useQuery({
    queryKey: ['stockLogisticsJobs'],
    queryFn: () => base44.entities.Job.filter({ purchase_order_id: { $ne: null } }),
    enabled: activeTab === 'jobs',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: () => base44.entities.Part.list(),
    enabled: activeTab === 'board',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const hasLoadingBayPOs = React.useMemo(() => {
    return purchaseOrders.some(po => {
      const normalized = normaliseLegacyPoStatus(po.status);
      return normalized === PO_STATUS.IN_LOADING_BAY;
    });
  }, [purchaseOrders]);

  const { data: purchaseOrderLines = [] } = useQuery({
    queryKey: ['purchaseOrderLines'],
    queryFn: () => base44.entities.PurchaseOrderLine.list(),
    enabled: activeTab === 'board' && hasLoadingBayPOs,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  // Group POs by status (normalize legacy statuses)
  const draftPOs = purchaseOrders.filter(po => normaliseLegacyPoStatus(po.status) === PO_STATUS.DRAFT);
  const onOrderPOs = purchaseOrders.filter(po => {
    const normalized = normaliseLegacyPoStatus(po.status);
    return [PO_STATUS.SENT, PO_STATUS.ON_ORDER, PO_STATUS.IN_TRANSIT].includes(normalized);
  });
  const readyAtSupplierPOs = purchaseOrders.filter(po => {
    const normalized = normaliseLegacyPoStatus(po.status);
    return normalized === PO_STATUS.IN_LOADING_BAY && po.delivery_method === PO_DELIVERY_METHOD.PICKUP;
  });
  const atDeliveryBayPOs = purchaseOrders.filter(po => {
    const normalized = normaliseLegacyPoStatus(po.status);
    return normalized === PO_STATUS.IN_LOADING_BAY && po.delivery_method === PO_DELIVERY_METHOD.DELIVERY;
  });
  const completedPOs = purchaseOrders.filter(po => {
    const normalized = normaliseLegacyPoStatus(po.status);
    return [PO_STATUS.IN_STORAGE, PO_STATUS.IN_VEHICLE, PO_STATUS.INSTALLED].includes(normalized);
  });

  // Loading bay summary
  const deliveredPOItems = purchaseOrderLines.filter(line => {
    const po = purchaseOrders.find(p => p.id === line.purchase_order_id);
    const normalized = normaliseLegacyPoStatus(po?.status);
    return po && normalized === PO_STATUS.IN_LOADING_BAY;
  });

  const loadingBayParts = parts.filter(p => {
    const normalized = normaliseLegacyPartLocation(p.location);
    return normalized === PART_LOCATION.LOADING_BAY;
  });
  const loadingBayTotal = deliveredPOItems.reduce((sum, item) => sum + (item.qty_ordered || 0), 0) + loadingBayParts.length;

  const handleCreatePO = async () => {
    try {
      const response = await base44.functions.invoke('managePurchaseOrder', {
        action: 'create',
        supplier_id: suppliers[0]?.id || 'temp',
        line_items: [{ name: 'New Item', quantity: 1, unit_price: 0 }]
      });

      if (response.data?.success && response.data?.purchaseOrder) {
        setActivePoId(response.data.purchaseOrder.id);
        toast.success('Draft Purchase Order created');
      } else {
        toast.error('Failed to create PO');
      }
    } catch (error) {
      toast.error('Failed to create Purchase Order');
    }
  };

  const POCard = ({ po }) => (
    <div
      className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm hover:bg-[#F9FAFB] transition-colors"
      onClick={() => setActivePoId(po.id)}
    >
      <div className="font-medium text-[#111827] mb-1">
        {getPoDisplayReference(po)}
      </div>
      {po.name && (
        <div className="text-[11px] text-[#4B5563] mb-1">{po.name}</div>
      )}
      <div className="mt-1 text-[11px] text-[#6B7280]">
        {po.supplier_name || "Supplier not set"}
      </div>
      {po.expected_date && (
        <div className="mt-1 text-[11px] text-[#6B7280]">
          ETA: {format(new Date(po.expected_date), "MMM d")}
        </div>
      )}
      {po.project_name && (
        <div className="mt-1 text-[11px] text-blue-600 font-medium">
          Project: {po.project_name}
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
    </div>
  );

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Supply & Logistics</h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Manage purchase orders, loading bay, and logistics jobs
            </p>
          </div>
          <Button
            onClick={handleCreatePO}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Purchase Order
          </Button>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setActiveTab("board")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "board" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setActiveTab("purchaseOrders")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "purchaseOrders" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
            }`}
          >
            Purchase Orders
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "jobs" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
            }`}
          >
            Logistics Jobs
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "board" && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border border-gray-200">
                <CardContent className="py-3">
                  <p className="text-xs text-gray-500">Draft POs</p>
                  <p className="text-xl font-semibold text-gray-900">{draftPOs.length}</p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200">
                <CardContent className="py-3">
                  <p className="text-xs text-gray-500">Active POs</p>
                  <p className="text-xl font-semibold text-gray-900">{onOrderPOs.length + readyAtSupplierPOs.length + atDeliveryBayPOs.length}</p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200">
                <CardContent className="py-3">
                  <p className="text-xs text-gray-500">Items in Loading Bay</p>
                  <p className="text-xl font-semibold text-gray-900">{loadingBayTotal}</p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200">
                <CardContent className="py-3">
                  <p className="text-xs text-gray-500">Logistics Jobs</p>
                  <p className="text-xl font-semibold text-gray-900">{stockLogisticsJobs.filter(j => j.status !== 'Completed').length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Kanban Board */}
            <div className="grid gap-4 md:grid-cols-5">
              {/* Draft */}
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">Draft</span>
                  <span className="text-xs text-[#6B7280]">{draftPOs.length}</span>
                </div>
                <div className="space-y-2">
                  {draftPOs.map(po => <POCard key={po.id} po={po} />)}
                  {!draftPOs.length && <div className="text-[11px] text-[#6B7280] text-center py-4">No POs</div>}
                </div>
              </div>

              {/* On Order */}
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">On Order</span>
                  <span className="text-xs text-[#6B7280]">{onOrderPOs.length}</span>
                </div>
                <div className="space-y-2">
                  {onOrderPOs.map(po => <POCard key={po.id} po={po} />)}
                  {!onOrderPOs.length && <div className="text-[11px] text-[#6B7280] text-center py-4">No POs</div>}
                </div>
              </div>

              {/* At Supplier */}
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">At Supplier</span>
                  <span className="text-xs text-[#6B7280]">{readyAtSupplierPOs.length}</span>
                </div>
                <div className="space-y-2">
                  {readyAtSupplierPOs.map(po => <POCard key={po.id} po={po} />)}
                  {!readyAtSupplierPOs.length && <div className="text-[11px] text-[#6B7280] text-center py-4">No POs</div>}
                </div>
              </div>

              {/* Loading Bay */}
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">Loading Bay</span>
                  <span className="text-xs text-[#6B7280]">{atDeliveryBayPOs.length}</span>
                </div>
                <div className="space-y-2">
                  {atDeliveryBayPOs.map(po => <POCard key={po.id} po={po} />)}
                  {!atDeliveryBayPOs.length && <div className="text-[11px] text-[#6B7280] text-center py-4">No POs</div>}
                </div>
              </div>

              {/* Completed */}
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">Completed</span>
                  <span className="text-xs text-[#6B7280]">{completedPOs.length}</span>
                </div>
                <div className="space-y-2">
                  {completedPOs.map(po => <POCard key={po.id} po={po} />)}
                  {!completedPOs.length && <div className="text-[11px] text-[#6B7280] text-center py-4">No POs</div>}
                </div>
              </div>
            </div>

            {/* Loading Bay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loading Bay</CardTitle>
                <p className="text-xs text-[#6B7280] mt-1">
                  {loadingBayTotal} items waiting to be moved
                </p>
              </CardHeader>
              <CardContent>
                {deliveredPOItems.length === 0 && loadingBayParts.length === 0 ? (
                  <div className="text-sm text-[#6B7280]">No items in Loading Bay.</div>
                ) : (
                  <div className="space-y-3">
                    {deliveredPOItems.map(item => {
                      const po = purchaseOrders.find(p => p.id === item.purchase_order_id);
                      return (
                        <div
                          key={item.id}
                          className="p-3 border rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                          onClick={() => setActivePoId(item.purchase_order_id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.item_name || 'Item'}</span>
                            <span className="text-xs text-[#6B7280]">Qty: {item.qty_ordered}</span>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            PO: {getPoDisplayReference(po)} • {po?.supplier_name}
                          </div>
                        </div>
                      );
                    })}
                    {loadingBayParts.map(part => (
                      <div key={part.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{part.category}</span>
                          <span className="text-xs text-[#6B7280]">Qty: {part.quantity_required || 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "purchaseOrders" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {purchaseOrders.map(po => (
                  <div
                    key={po.id}
                    className="p-4 border rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    onClick={() => setActivePoId(po.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="space-y-1 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {getPoDisplayReference(po)}
                            </span>
                            <Badge className="text-xs bg-slate-100 text-slate-700">
                              {po.status}
                            </Badge>
                          </div>
                          {po.name && (
                            <div className="text-xs text-[#4B5563]">{po.name}</div>
                          )}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          {po.supplier_name || 'Supplier'}
                          {po.project_name && ` • Project: ${po.project_name}`}
                          {po.expected_date && ` • ETA: ${format(new Date(po.expected_date), 'MMM d, yyyy')}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {purchaseOrders.length === 0 && (
                  <div className="text-center py-8 text-[#6B7280]">No purchase orders yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "jobs" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logistics Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stockLogisticsJobs.map(job => {
                  const po = purchaseOrders.find(p => p.id === job.purchase_order_id);
                  const supplier = suppliers.find(s => s.id === po?.supplier_id);
                  return (
                    <div
                      key={job.id}
                      className="p-4 border rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                      onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {supplier?.name || po?.supplier_name || 'Logistics Job'}
                            </span>
                            <StatusBadge value={job.status} />
                          </div>
                          <div className="text-xs text-[#6B7280]">
                            {job.scheduled_date && `${format(parseISO(job.scheduled_date), 'MMM d, yyyy')}`}
                            {job.scheduled_time && ` at ${job.scheduled_time}`}
                            {po && ` • PO: ${getPoDisplayReference(po)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {stockLogisticsJobs.length === 0 && (
                  <div className="text-center py-8 text-[#6B7280]">No logistics jobs yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <PurchaseOrderModal
        poId={activePoId}
        open={!!activePoId}
        onClose={() => setActivePoId(null)}
      />
    </div>
  );
}