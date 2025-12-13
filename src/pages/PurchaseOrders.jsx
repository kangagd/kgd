import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { PO_STATUS_OPTIONS, PO_STATUS, getPoStatusLabel } from "@/components/domain/purchaseOrderStatusConfig";
import { DELIVERY_METHOD as PO_DELIVERY_METHOD } from "@/components/domain/supplierDeliveryConfig";
import BackButton from "../components/common/BackButton";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import PurchaseOrderDetail from "../components/logistics/PurchaseOrderDetail";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('poId');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        po.po_reference?.toLowerCase().includes(q) ||
        po.supplier_name?.toLowerCase().includes(q);
      
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      
      const matchesSupplier = !supplierFilter || po.supplier_id === supplierFilter;
      
      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [purchaseOrders, searchTerm, statusFilter, supplierFilter]);

  const handleCreatePO = async () => {
    try {
      // Create a draft PO with minimal data
      const response = await base44.functions.invoke('managePurchaseOrder', {
        action: 'create',
        supplier_id: suppliers[0]?.id || 'temp', // Use first supplier or temp
        line_items: [{ name: 'New Item', qty: 1, price: 0 }]
      });

      if (response.data?.success && response.data?.purchaseOrder) {
        const newPO = response.data.purchaseOrder;
        navigate(`${createPageUrl("PurchaseOrders")}?poId=${newPO.id}`);
        toast.success('Draft Purchase Order created');
      } else {
        toast.error('Failed to create PO');
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error('Failed to create Purchase Order');
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Draft': 'bg-slate-100 text-slate-700',
      'Sent': 'bg-blue-100 text-blue-700',
      'Confirmed': 'bg-purple-100 text-purple-700',
      'Ready to Pick Up': 'bg-amber-100 text-amber-700',
      'Delivered to Delivery Bay': 'bg-cyan-100 text-cyan-700',
      'Completed - In Storage': 'bg-emerald-100 text-emerald-700',
      'Completed - In Vehicle': 'bg-teal-100 text-teal-700',
    };
    return statusColors[status] || 'bg-slate-100 text-slate-700';
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canCreate = isAdmin || isManager;

  const handleStatusChange = async (po, newStatus) => {
    try {
      const response = await base44.functions.invoke('managePurchaseOrder', {
        action: 'updateStatus',
        id: po.id,
        status: newStatus
      });

      if (!response.data?.success) {
        toast.error(response.data?.error || 'Failed to update status');
        return;
      }

      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  // Show detail view if poId is present
  if (poId) {
    return (
      <PurchaseOrderDetail
        poId={poId}
        onClose={() => navigate(createPageUrl("PurchaseOrders"))}
      />
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111827] leading-tight">
              Purchase Orders
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Manage purchase orders and stock deliveries
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={handleCreatePO}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search by PO number or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px] h-10">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PO_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full md:w-[200px] h-10">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || supplierFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setSupplierFilter("");
                }}
                className="h-10"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[#6B7280]">Loading purchase orders...</p>
          </div>
        )}

        {!isLoading && filteredPOs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-[#E5E7EB]">
            <Package className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
            <p className="text-[14px] text-[#4B5563] leading-[1.4] mb-4">
              {searchTerm || statusFilter !== "all" || supplierFilter
                ? "No purchase orders found matching your filters"
                : "No purchase orders yet"}
            </p>
            {canCreate && (
              <Button
                onClick={handleCreatePO}
                className="bg-[#FAE008] text-[#111827] font-semibold text-[14px] leading-[1.4]"
              >
                Create First Purchase Order
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4">
          {filteredPOs.map((po) => (
            <Card
              key={po.id}
              className="hover:shadow-lg transition-all duration-200 hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl cursor-pointer"
              onClick={() => navigate(`${createPageUrl("PurchaseOrders")}?poId=${po.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                        {getPoDisplayReference(po)}
                      </h3>
                      <Select
                        value={po.status}
                        onValueChange={(value) => handleStatusChange(po, value)}
                      >
                        <SelectTrigger 
                          className={`h-6 w-auto min-w-[100px] text-xs ${getStatusColor(po.status)} border-0`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue>
                            {getPoStatusLabel(po.status)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          {PO_STATUS_OPTIONS.filter((status) => {
                            // For DELIVERY: exclude "Ready to Pick Up"
                            if (po.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) {
                              return false;
                            }
                            // For PICKUP: exclude "Delivered to Delivery Bay"
                            if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) {
                              return false;
                            }
                            return true;
                          }).map((status) => (
                            <SelectItem key={status} value={status}>
                              {getPoStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4 text-[#4B5563] text-[14px] leading-[1.4] flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-4 h-4" />
                        <span>{po.supplier_name || 'No supplier'}</span>
                      </div>
                      {po.project_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#6B7280]">Project:</span>
                          <span className="font-medium text-[#111827]">{po.project_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#6B7280]">Created:</span>
                        <span>
                          {po.order_date 
                            ? format(parseISO(po.order_date), 'MMM d, yyyy')
                            : po.created_date 
                              ? format(parseISO(po.created_date), 'MMM d, yyyy')
                              : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}