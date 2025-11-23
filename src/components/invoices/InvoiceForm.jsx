import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";

export default function InvoiceForm({ job, onSuccess, onCancel }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list()
  });

  const filteredItems = priceListItems.filter(item =>
    item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (priceListItem) => {
    const existingItem = selectedItems.find(i => i.price_list_item_id === priceListItem.id);
    if (existingItem) {
      setSelectedItems(selectedItems.map(i =>
        i.price_list_item_id === priceListItem.id
          ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price }
          : i
      ));
    } else {
      setSelectedItems([...selectedItems, {
        price_list_item_id: priceListItem.id,
        item_name: priceListItem.item,
        quantity: 1,
        unit_price: priceListItem.price,
        line_total: priceListItem.price
      }]);
    }
    setSearchTerm("");
  };

  const updateQuantity = (index, quantity) => {
    const newItems = [...selectedItems];
    newItems[index].quantity = Math.max(1, parseInt(quantity) || 1);
    newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
    setSelectedItems(newItems);
  };

  const updatePrice = (index, price) => {
    const newItems = [...selectedItems];
    newItems[index].unit_price = Math.max(0, parseFloat(price) || 0);
    newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
    setSelectedItems(newItems);
  };

  const removeItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const subtotal = selectedItems.reduce((sum, item) => sum + item.line_total, 0);
  const taxRate = 0.10; // 10% GST
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert("Please add at least one item to the invoice");
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      
      const invoice = await base44.entities.Invoice.create({
        invoice_number: invoiceNumber,
        job_id: job.id,
        job_number: job.job_number,
        customer_id: job.customer_id,
        customer_name: job.customer_name,
        customer_email: job.customer_email,
        customer_phone: job.customer_phone,
        address_full: job.address_full || job.address,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total: total,
        status: "Draft",
        notes: notes
      });

      for (const item of selectedItems) {
        await base44.entities.InvoiceLineItem.create({
          invoice_id: invoice.id,
          ...item
        });
      }

      onSuccess(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert("Failed to create invoice: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <Input value={job.customer_name} disabled className="bg-[#F3F4F6]" />
            </div>
            <div>
              <Label>Job #</Label>
              <Input value={job.job_number} disabled className="bg-[#F3F4F6]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search parts and services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
            {searchTerm && filteredItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full text-left px-4 py-2 hover:bg-[#F3F4F6] border-b border-[#E5E7EB] last:border-0"
                  >
                    <div className="font-medium text-[#111827]">{item.item}</div>
                    <div className="text-sm text-[#6B7280]">
                      {item.category} • ${item.price.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedItems.length === 0 && (
            <div className="text-center py-8 text-[#6B7280]">
              No items added yet. Search and select items above.
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="space-y-2">
              {selectedItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                  <div className="flex-1">
                    <div className="font-medium text-[#111827]">{item.item_name}</div>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(index, e.target.value)}
                      className="text-center"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(index, e.target.value)}
                    />
                  </div>
                  <div className="w-24 text-right font-semibold text-[#111827]">
                    ${item.line_total.toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[#E5E7EB] pt-4 space-y-2">
            <div className="flex justify-between text-[#4B5563]">
              <span>Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#4B5563]">
              <span>GST (10%)</span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-[#111827] pt-2 border-t border-[#E5E7EB]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any additional notes or payment terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || selectedItems.length === 0}
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
        >
          {isSubmitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}