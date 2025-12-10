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
import { X, Plus, Trash2, Package, Truck, Save, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PO_STATUS, PO_DELIVERY_METHOD_OPTIONS } from "@/components/domain/logisticsConfig";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function PurchaseOrderDetail({ poId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: "",
    project_id: "",
    delivery_method: "",
    notes: "",
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

  // Fetch line items separately if needed
  const { data: lineItems = [] } = useQuery({
    queryKey: ['purchaseOrderLines', poId],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ purchase_order_id: poId }),
    enabled: !!poId
  });

  useEffect(() => {
    if (po) {
      // Map line items from separate entity if po.line_items is not populated
      const items = po.line_items?.length > 0 
        ? po.line_items 
        : lineItems.map(line => ({
            name: line.description || line.item_name || '',
            quantity: line.qty_ordered || 0,
            unit_price: line.unit_price || line.unit_cost_ex_tax || 0,
            price_list_item_id: line.price_list_item_id
          }));

      setFormData({
        supplier_id: po.supplier_id || "",
        project_id: po.project_id || "",
        delivery_method: po.delivery_method || "",
        notes: po.notes || "",
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
    onSuccess: (data) => {
      // Update local form state with saved data to reflect any backend changes
      if (data.purchaseOrder) {
        const items = data.purchaseOrder.line_items || [];
        setFormData({
          supplier_id: data.purchaseOrder.supplier_id || "",
          project_id: data.purchaseOrder.project_id || "",
          delivery_method: data.purchaseOrder.delivery_method || "",
          notes: data.purchaseOrder.notes || "",
          line_items: items
        });
      }
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
    updatePOMutation.mutate({
      action: 'update',
      id: poId,
      supplier_id: formData.supplier_id,
      supplier_name: supplier?.name || "",
      project_id: formData.project_id,
      delivery_method: formData.delivery_method,
      notes: formData.notes,
      line_items: formData.line_items
    });
  };

  const handleSendToSupplier = () => {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier before sending');
      return;
    }
    if (formData.line_items.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    updatePOMutation.mutate({
      action: 'updateStatus',
      id: poId,
      status: PO_STATUS.SENT
    });
  };

  const handleCreateLogisticsJob = () => {
    createLogisticsJobMutation.mutate();
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [...formData.line_items, { name: '', quantity: 1, unit_price: 0 }]
    });
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
      'Acknowledged': 'bg-purple-100 text-purple-700',
      'In Transit': 'bg-amber-100 text-amber-700',
      'Arrived': 'bg-green-100 text-green-700',
      'Completed': 'bg-emerald-100 text-emerald-700',
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
  const canCreateLogistics = [PO_STATUS.SENT, 'In Transit', 'Arrived'].includes(po.status);

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
            <div>
              <h2 className="text-xl font-bold text-[#111827]">
                PO #{po.po_number || po.id.slice(0, 8)}
              </h2>
              <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
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
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
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
                value={formData.delivery_method}
                onValueChange={(value) => setFormData({ ...formData, delivery_method: value })}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  {PO_DELIVERY_METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
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
                <Button
                  onClick={addLineItem}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
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
                  <div key={index} className="flex gap-3 items-start border-b pb-3 last:border-b-0">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Item name/description"
                        value={item.name || ''}
                        onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                        disabled={!isDraft}
                      />
                      <div className="flex gap-2">
                        <div className="w-24">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity || ''}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Unit Price"
                            value={item.unit_price || ''}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="w-32 flex items-center justify-end">
                          <span className="text-sm font-medium">
                            ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isDraft && (
                      <button
                        onClick={() => removeLineItem(index)}
                        className="p-2 hover:bg-red-50 rounded text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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