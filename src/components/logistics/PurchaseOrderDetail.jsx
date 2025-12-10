import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Package, Truck, Save, Send, ArrowRight, List, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PO_STATUS, PO_STATUS_OPTIONS, PO_DELIVERY_METHOD, PO_DELIVERY_METHOD_OPTIONS } from "@/components/domain/logisticsConfig";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function PurchaseOrderDetail({ poId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: "",
    project_id: "",
    delivery_method: "",
    notes: "",
    reference: "",
    status: PO_STATUS.DRAFT,
    line_items: []
  });

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrder', poId],
    queryFn: () => base44.entities.PurchaseOrder.get(poId),
    enabled: !!poId
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list()
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date')
  });

  const { data: linkedJob } = useQuery({
    queryKey: ['linkedJob', po?.linked_logistics_job_id],
    queryFn: () => base44.entities.Job.get(po.linked_logistics_job_id),
    enabled: !!po?.linked_logistics_job_id
  });

  // Fetch additional data for line item sources
  const { data: lineItems = [] } = useQuery({
    queryKey: ['purchaseOrderLines', poId],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ purchase_order_id: poId }),
    enabled: !!poId
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.filter({ is_active: true })
  });

  const { data: projectParts = [] } = useQuery({
    queryKey: ['projectParts', formData.project_id],
    queryFn: () => base44.entities.Part.filter({ project_id: formData.project_id }),
    enabled: !!formData.project_id
  });

  useEffect(() => {
    if (po) {
      console.log('PO data from server:', { 
        project_id: po.project_id, 
        delivery_method: po.delivery_method 
      });
      
      // Map line items from separate entity if po.line_items is not populated
      const items = po.line_items?.length > 0 
        ? po.line_items 
        : lineItems.map(line => ({
            id: line.id,
            source_type: line.source_type || "custom",
            source_id: line.source_id || line.price_list_item_id || null,
            name: line.item_name || line.description || '',
            quantity: line.qty_ordered || 0,
            unit_price: line.unit_cost_ex_tax || 0,
            unit: line.unit || null,
            notes: line.notes || null
          }));

      setFormData({
        supplier_id: po.supplier_id || "",
        project_id: po.project_id || "",
        delivery_method: po.delivery_method || "",
        notes: po.notes || "",
        reference: po.po_number || "",
        status: po.status || PO_STATUS.DRAFT,
        line_items: items
      });
      setIsEditing(po.status === PO_STATUS.DRAFT);
    }
  }, [po, lineItems]);

  const updatePOMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('managePurchaseOrder', data);
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to update PO');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrderLines', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Purchase Order updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update Purchase Order');
    }
  });

  const createLogisticsJobMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createLogisticsJobForPO', {
        purchase_order_id: poId
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to create logistics job');
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success('Logistics job created');
      if (data.job?.id) {
        navigate(`${createPageUrl("Jobs")}?jobId=${data.job.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create logistics job');
    }
  });

  const handleSave = () => {
    const supplier = suppliers.find(s => s.id === formData.supplier_id);
    const dataToSend = {
      action: 'update',
      id: poId,
      supplier_id: formData.supplier_id,
      supplier_name: supplier?.name || "",
      project_id: formData.project_id || null,
      delivery_method: formData.delivery_method || null,
      notes: formData.notes,
      reference: formData.reference,
      line_items: formData.line_items
    };
    console.log('Saving PO with data:', dataToSend);
    updatePOMutation.mutate(dataToSend);
  };

  const handleSendToSupplier = async () => {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier before sending');
      return;
    }
    if (formData.line_items.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    
    // First save any pending changes
    const supplier = suppliers.find(s => s.id === formData.supplier_id);
    await updatePOMutation.mutateAsync({
      action: 'update',
      id: poId,
      supplier_id: formData.supplier_id,
      supplier_name: supplier?.name || "",
      project_id: formData.project_id,
      delivery_method: formData.delivery_method,
      notes: formData.notes,
      reference: formData.reference,
      line_items: formData.line_items
    });
    
    // Then update status to Sent
    updatePOMutation.mutate({
      action: 'updateStatus',
      id: poId,
      status: PO_STATUS.SENT
    });
  };

  const handleCreateLogisticsJob = () => {
    createLogisticsJobMutation.mutate();
  };

  const [addItemMenuOpen, setAddItemMenuOpen] = useState(false);
  const [priceListSearch, setPriceListSearch] = useState("");

  const addLineItem = (sourceType = "custom", sourceItem = null) => {
    const newItem = { 
      source_type: sourceType,
      source_id: sourceItem?.id || null,
      name: sourceItem?.item || sourceItem?.category || '', 
      quantity: 1, 
      unit_price: sourceItem?.unit_cost || sourceItem?.price || 0,
      unit: null,
      notes: null
    };
    setFormData({
      ...formData,
      line_items: [...formData.line_items, newItem]
    });
    setAddItemMenuOpen(false);
  };

  const removeLineItem = (index) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index)
    });
  };

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...formData.line_items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, line_items: updatedItems });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-slate-100 text-slate-700',
      'Sent': 'bg-blue-100 text-blue-700',
      'Confirmed': 'bg-purple-100 text-purple-700',
      'Ready to Pick Up': 'bg-amber-100 text-amber-700',
      'Delivered to Delivery Bay': 'bg-cyan-100 text-cyan-700',
      'Completed - In Storage': 'bg-emerald-100 text-emerald-700',
      'Completed - In Vehicle': 'bg-teal-100 text-teal-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const calculateTotal = () => {
    return formData.line_items.reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-[#6B7280]">Loading purchase order...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-[#DC2626]">Purchase order not found</p>
      </div>
    );
  }

  const isDraft = po.status === PO_STATUS.DRAFT;
  const canCreateLogistics = [
    PO_STATUS.SENT, 
    PO_STATUS.CONFIRMED, 
    PO_STATUS.READY_TO_PICK_UP,
    PO_STATUS.DELIVERED_TO_DELIVERY_BAY
  ].includes(po.status);

  return (
    <div className="bg-white min-h-screen">
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#111827]">Purchase Order</h2>
                <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
              </div>
              {isDraft ? (
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Enter PO reference/number..."
                  className="mt-2 max-w-xs text-sm"
                />
              ) : (
                <p className="text-sm text-[#6B7280] mt-1">
                  {po.po_number || `ID: ${po.id.slice(0, 8)}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updatePOMutation.isPending}
                  className="bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={handleSendToSupplier}
                  disabled={updatePOMutation.isPending}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to Supplier
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[18px]">Purchase Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Project (Optional)</Label>
              <Select
                value={formData.project_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, project_id: value === "none" ? "" : value })}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.filter(p => !p.deleted_at).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Delivery Method</Label>
              <Select
                value={formData.delivery_method || "placeholder"}
                onValueChange={(value) => setFormData({ ...formData, delivery_method: value === "placeholder" ? "" : value })}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder">Select delivery method</SelectItem>
                  {PO_DELIVERY_METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={async (value) => {
                  setFormData((prev) => ({ ...prev, status: value }));

                  try {
                    const response = await base44.functions.invoke("managePurchaseOrder", {
                      action: "updateStatus",
                      id: po.id,
                      status: value,
                    });

                    if (!response?.data?.success) {
                      setFormData((prev) => ({ ...prev, status: po.status }));
                      toast.error(response?.data?.error || "Failed to update status");
                      return;
                    }

                    const updated = response.data.purchaseOrder || po;
                    queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
                    queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
                    setFormData((prev) => ({ ...prev, status: updated.status ?? value }));
                    toast.success("Status updated");
                  } catch (error) {
                    setFormData((prev) => ({ ...prev, status: po.status }));
                    toast.error("Error updating status");
                  }
                }}
                disabled={updatePOMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {PO_STATUS_OPTIONS.filter((status) => {
                    // For DELIVERY: exclude "Ready to Pick Up"
                    if (formData.delivery_method === PO_DELIVERY_METHOD.PICKUP && status === PO_STATUS.DELIVERED_TO_DELIVERY_BAY) {
                      return false;
                    }
                    // For PICKUP: exclude "Delivered to Delivery Bay"
                    if (formData.delivery_method === PO_DELIVERY_METHOD.DELIVERY && status === PO_STATUS.READY_TO_PICK_UP) {
                      return false;
                    }
                    return true;
                  }).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={!isDraft}
                placeholder="Add any notes or special instructions..."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[18px]">Line Items</CardTitle>
              {isDraft && (
                <Popover open={addItemMenuOpen} onOpenChange={setAddItemMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="end">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addLineItem("custom")}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Custom Item
                      </Button>
                      <div className="border-t my-1" />
                      {priceListItems.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-2 py-1 text-xs font-medium text-[#6B7280]">From Price List</div>
                          <Input
                            placeholder="Search items..."
                            value={priceListSearch}
                            onChange={(e) => setPriceListSearch(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {priceListItems
                              .filter(item => 
                                !priceListSearch || 
                                item.item?.toLowerCase().includes(priceListSearch.toLowerCase()) ||
                                item.sku?.toLowerCase().includes(priceListSearch.toLowerCase())
                              )
                              .map((item) => (
                                <Button
                                  key={item.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-xs"
                                  onClick={() => {
                                    addLineItem("price_list", item);
                                    setPriceListSearch("");
                                  }}
                                >
                                  <List className="w-3 h-3 mr-2" />
                                  {item.item}
                                </Button>
                              ))}
                          </div>
                        </div>
                      )}
                      {projectParts.length > 0 && (
                        <>
                          <div className="border-t my-1" />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            <div className="px-2 py-1 text-xs font-medium text-[#6B7280]">From Project Parts</div>
                            {projectParts.map((part) => (
                              <Button
                                key={part.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs"
                                onClick={() => addLineItem("project_part", part)}
                              >
                                <ShoppingCart className="w-3 h-3 mr-2" />
                                {part.category}
                              </Button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {formData.line_items.length === 0 ? (
              <p className="text-[#6B7280] text-sm text-center py-4">
                No line items yet. Click "Add Item" to start.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.line_items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    {/* Source Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {item.source_type === "price_list" && "Price List"}
                        {item.source_type === "project_part" && "Project Part"}
                        {item.source_type === "stock_item" && "Stock Item"}
                        {item.source_type === "custom" && "Custom"}
                      </Badge>
                      {isDraft && (
                        <button
                          onClick={() => removeLineItem(index)}
                          className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Item name/description"
                        value={item.name || ''}
                        onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                        disabled={!isDraft}
                        className="font-medium"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-[#6B7280]">Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">Unit Price</Label>
                          <Input
                            type="number"
                            value={item.unit_price || ''}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">Total</Label>
                          <div className="h-10 flex items-center justify-end px-3 bg-[#F3F4F6] rounded-lg">
                            <span className="text-sm font-semibold">
                              ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isDraft && (
                        <Input
                          placeholder="Notes (optional)"
                          value={item.notes || ''}
                          onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-3 border-t">
                  <div className="text-right">
                    <span className="text-sm text-[#6B7280]">Total: </span>
                    <span className="text-lg font-bold text-[#111827]">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logistics Section */}
        {canCreateLogistics && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[18px] flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Logistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {po.linked_logistics_job_id ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">
                    A logistics job has been created for this purchase order.
                  </p>
                  <Button
                    onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${po.linked_logistics_job_id}`)}
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    View Logistics Job {linkedJob?.job_number ? `#${linkedJob.job_number}` : ''}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">
                    Create a logistics job to track delivery from {formData.delivery_method === 'Supplier → Pickup Required' ? 'supplier pickup' : 'supplier to warehouse'}.
                  </p>
                  <Button
                    onClick={handleCreateLogisticsJob}
                    disabled={createLogisticsJobMutation.isPending}
                    className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Create Logistics Job
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}