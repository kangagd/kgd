import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function QuoteItemManager({ quote, quoteItems, quoteSections, onUpdate }) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    product_id: "",
    title: "",
    description: "",
    quantity: 1,
    unit_price: 0,
    unit_label: "each",
    is_optional: false,
    is_selected: true
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list()
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
      recalculateTotals();
      setNewItem({
        product_id: "",
        title: "",
        description: "",
        quantity: 1,
        unit_price: 0,
        unit_label: "each",
        is_optional: false,
        is_selected: true
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
      recalculateTotals();
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
      recalculateTotals();
    }
  });

  const recalculateTotals = () => {
    const items = quoteItems.filter(item => !item.is_optional || item.is_selected);
    const subtotal = items.reduce((sum, item) => {
      const lineSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      return sum + lineSubtotal;
    }, 0);
    
    const taxTotal = items.reduce((sum, item) => {
      const lineSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      const lineTax = lineSubtotal * (item.tax_rate || 0.1);
      return sum + lineTax;
    }, 0);

    const total = subtotal + taxTotal;

    onUpdate({
      ...quote,
      subtotal,
      tax_total: taxTotal,
      total
    });
  };

  const handleAddItem = () => {
    const lineSubtotal = (newItem.quantity * newItem.unit_price) - (newItem.discount || 0);
    const lineTax = lineSubtotal * 0.1;
    const lineTotal = lineSubtotal + lineTax;

    createItemMutation.mutate({
      ...newItem,
      quote_id: quote.id,
      line_subtotal: lineSubtotal,
      line_total: lineTotal,
      tax_rate: 0.1
    });
  };

  const handleDeleteItem = (itemId) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleToggleOptional = (item) => {
    const updatedData = {
      ...item,
      is_selected: !item.is_selected
    };
    updateItemMutation.mutate({ id: item.id, data: updatedData });
  };

  const handleProductSelect = (productId) => {
    const product = priceListItems.find(p => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        product_id: productId,
        title: product.item,
        description: product.description || "",
        unit_price: product.price
      });
    } else {
      setNewItem({
        ...newItem,
        product_id: "",
        title: "",
        description: "",
        unit_price: 0
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border border-[#E5E7EB]">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">Add Line Item</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Select from Price List (Optional)</Label>
              <Select value={newItem.product_id} onValueChange={handleProductSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product or enter custom item below" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Custom Item (No Product)</SelectItem>
                  {priceListItems.filter(p => p.in_inventory !== false).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.item} - ${product.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item Title *</Label>
              <Input
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="e.g., Garage Door Installation"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Label</Label>
              <Input
                value={newItem.unit_label}
                onChange={(e) => setNewItem({ ...newItem, unit_label: e.target.value })}
                placeholder="e.g., each, set"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Price *</Label>
              <Input
                type="number"
                value={newItem.unit_price}
                onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Add item description..."
                className="min-h-[60px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newItem.is_optional}
                onCheckedChange={(checked) => setNewItem({ ...newItem, is_optional: checked })}
              />
              <Label>Optional Item</Label>
            </div>
          </div>
          <Button
            onClick={handleAddItem}
            disabled={!newItem.title || createItemMutation.isPending}
            className="mt-4 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-[#111827]">Quote Items</h3>
        {quoteItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
            <p className="text-[#6B7280]">No items added yet</p>
          </div>
        ) : (
          quoteItems.map((item) => (
            <Card key={item.id} className="bg-white border border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-[#111827]">{item.title}</h4>
                      {item.is_optional && (
                        <span className="text-xs bg-[#FAE008]/20 text-[#92400E] px-2 py-0.5 rounded-lg">
                          Optional
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-[#6B7280] mb-3">{item.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-[#6B7280]">Qty: </span>
                        <span className="text-[#111827] font-medium">{item.quantity} {item.unit_label}</span>
                      </div>
                      <div>
                        <span className="text-[#6B7280]">Price: </span>
                        <span className="text-[#111827] font-medium">
                          ${item.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {item.is_optional && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_selected}
                            onCheckedChange={() => handleToggleOptional(item)}
                          />
                          <span className="text-xs text-[#6B7280]">
                            {item.is_selected ? 'Included' : 'Excluded'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#111827] mb-2">
                      ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteItem(item.id)}
                      className="hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-[#F9FAFB] border border-[#E5E7EB]">
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Subtotal:</span>
              <span className="font-medium text-[#111827]">
                ${(quote.subtotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Tax (GST):</span>
              <span className="font-medium text-[#111827]">
                ${(quote.tax_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
              <span className="text-lg font-semibold text-[#111827]">Total:</span>
              <span className="text-2xl font-bold text-[#111827]">
                ${(quote.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}