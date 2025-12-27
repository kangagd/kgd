import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as poApi from "@/components/api/purchaseOrdersV2Api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, Plus, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  in_transit: "bg-purple-100 text-purple-800",
  arrived: "bg-green-100 text-green-800",
  put_away: "bg-teal-100 text-teal-800",
  closed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-800"
};

export default function PurchaseOrderV2Detail() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');

  const [editedHeader, setEditedHeader] = useState({});
  const [editedLines, setEditedLines] = useState([]);
  const [hasUnsavedLines, setHasUnsavedLines] = useState(false);

  // Fetch PO with lines
  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrderV2', poId],
    queryFn: async () => {
      const pos = await base44.entities.PurchaseOrderV2.filter({ id: poId });
      if (!pos || pos.length === 0) throw new Error('PO not found');
      
      const lines = await base44.entities.PurchaseOrderLineV2.filter({ purchase_order_v2_id: poId });
      
      return { ...pos[0], lines: lines || [] };
    },
    enabled: !!poId
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name')
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventoryItemsV2'],
    queryFn: () => base44.entities.InventoryItemV2.filter({ is_active: true }, 'name')
  });

  // Initialize edited state when PO loads
  useEffect(() => {
    if (po) {
      setEditedHeader({
        supplier_id: po.supplier_id,
        expected_date: po.expected_date || '',
        notes: po.notes || '',
        name: po.name || '',
        delivery_method: po.delivery_method,
        delivery_location: po.delivery_location || ''
      });
      setEditedLines(po.lines.map(line => ({ ...line })));
      setHasUnsavedLines(false);
    }
  }, [po]);

  // Mutations
  const updateHeaderMutation = useMutation({
    mutationFn: poApi.updateHeader,
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrderV2', poId]);
      toast.success('Header updated');
    },
    onError: (error) => toast.error(error.message)
  });

  const setStatusMutation = useMutation({
    mutationFn: poApi.setStatus,
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrderV2', poId]);
      toast.success('Status updated');
    },
    onError: (error) => toast.error(error.message)
  });

  const setLinesMutation = useMutation({
    mutationFn: poApi.setLines,
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrderV2', poId]);
      setHasUnsavedLines(false);
      toast.success('Lines saved');
    },
    onError: (error) => toast.error(error.message)
  });

  const receiveMutation = useMutation({
    mutationFn: poApi.receiveIntoLoadingBay,
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrderV2', poId]);
      toast.success('Items received into loading bay');
    },
    onError: (error) => toast.error(error.message)
  });

  if (isLoading) {
    return <div className="max-w-6xl mx-auto p-6">Loading...</div>;
  }

  if (!po) {
    return <div className="max-w-6xl mx-auto p-6">PO not found</div>;
  }

  const handleSaveHeader = () => {
    updateHeaderMutation.mutate({ id: poId, ...editedHeader });
  };

  const handleStatusChange = (status) => {
    setStatusMutation.mutate({ id: poId, status });
  };

  const handleSaveLines = () => {
    setLinesMutation.mutate({ id: poId, lines: editedLines });
  };

  const handleAddLine = () => {
    setEditedLines([...editedLines, {
      item_name: '',
      sku: '',
      qty: 1,
      unit_cost_ex_tax: 0,
      inventory_item_id: null,
      notes: ''
    }]);
    setHasUnsavedLines(true);
  };

  const handleRemoveLine = (index) => {
    setEditedLines(editedLines.filter((_, i) => i !== index));
    setHasUnsavedLines(true);
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...editedLines];
    updated[index] = { ...updated[index], [field]: value };
    setEditedLines(updated);
    setHasUnsavedLines(true);
  };

  const handleReceive = () => {
    const received_lines = editedLines.map(line => ({
      line_id: line.id,
      received_qty: line.qty
    })).filter(l => l.line_id);

    if (received_lines.length === 0) {
      toast.error('No lines to receive. Save lines first.');
      return;
    }

    receiveMutation.mutate({ id: poId, received_lines });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">{po.po_ref}</h1>
            {po.name && <p className="text-gray-600">{po.name}</p>}
          </div>
          <Badge className={STATUS_COLORS[po.status]}>
            {po.status.replace('_', ' ')}
          </Badge>
        </div>
        <Select value={po.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="arrived">Arrived</SelectItem>
            <SelectItem value="put_away">Put Away</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name (optional)</Label>
              <Input
                value={editedHeader.name || ''}
                onChange={(e) => setEditedHeader({ ...editedHeader, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Supplier</Label>
              <Select
                value={editedHeader.supplier_id}
                onValueChange={(value) => setEditedHeader({ ...editedHeader, supplier_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Date</Label>
              <Input
                type="date"
                value={editedHeader.expected_date || ''}
                onChange={(e) => setEditedHeader({ ...editedHeader, expected_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Delivery Method</Label>
              <Select
                value={editedHeader.delivery_method}
                onValueChange={(value) => setEditedHeader({ ...editedHeader, delivery_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Delivery Location</Label>
            <Input
              value={editedHeader.delivery_location || ''}
              onChange={(e) => setEditedHeader({ ...editedHeader, delivery_location: e.target.value })}
              placeholder="Address or location details"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={editedHeader.notes || ''}
              onChange={(e) => setEditedHeader({ ...editedHeader, notes: e.target.value })}
              rows={3}
            />
          </div>
          <Button onClick={handleSaveHeader} disabled={updateHeaderMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Header
          </Button>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Line Items</CardTitle>
            <Button onClick={handleAddLine} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editedLines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No line items yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {editedLines.map((line, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-2">
                      <Label>Item Name</Label>
                      <Input
                        value={line.item_name}
                        onChange={(e) => handleLineChange(index, 'item_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={line.sku || ''}
                        onChange={(e) => handleLineChange(index, 'sku', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        value={line.qty}
                        onChange={(e) => handleLineChange(index, 'qty', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.unit_cost_ex_tax || ''}
                        onChange={(e) => handleLineChange(index, 'unit_cost_ex_tax', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLine(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={line.notes || ''}
                      onChange={(e) => handleLineChange(index, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {hasUnsavedLines && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSaveLines} disabled={setLinesMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save Lines
              </Button>
              {editedLines.length > 0 && po.status === 'sent' && (
                <Button onClick={handleReceive} variant="outline" disabled={receiveMutation.isPending}>
                  <Package className="w-4 h-4 mr-2" />
                  Receive into Loading Bay
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasUnsavedLines && editedLines.length > 0 && po.status === 'sent' && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleReceive} disabled={receiveMutation.isPending}>
              <Package className="w-4 h-4 mr-2" />
              Receive into Loading Bay
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}