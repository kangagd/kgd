import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SupplierPurchaseOrderModal({ open, onClose, supplier }) {
  const queryClient = useQueryClient();
  const [poNumber, setPoNumber] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);

  // Fetch Inventory Locations
  const { data: locations = [] } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: () => base44.entities.InventoryLocation.filter({ is_active: true }),
    enabled: open,
  });

  // Fetch Price List Items (filtered by supplier if possible, but fetching all for dropdown logic)
  const { data: priceListItems = [] } = useQuery({
    queryKey: ["price-list-items"],
    queryFn: () => base44.entities.PriceListItem.filter({ is_active: true }),
    enabled: open,
  });

  // Filter items for this supplier to prioritize or filter dropdown
  const supplierItems = React.useMemo(() => {
    if (!supplier) return [];
    return priceListItems.filter(item => item.supplier_id === supplier.id);
  }, [priceListItems, supplier]);

  // Use all items for the dropdown, but maybe sort supplier items to top? 
  // For now, just use all items to allow ordering anything from this supplier even if not explicitly linked yet.
  const availableItems = priceListItems;

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setPoNumber("");
      setOrderDate(format(new Date(), "yyyy-MM-dd"));
      setExpectedDate("");
      setDeliveryLocationId("");
      setNotes("");
      setLines([{ 
        price_list_item_id: "", 
        description: "", 
        qty_ordered: 1, 
        unit_cost_ex_tax: "", 
        tax_rate_percent: 0 
      }]);
    }
  }, [open, supplier]);

  const handleAddLine = () => {
    setLines([...lines, { 
      price_list_item_id: "", 
      description: "", 
      qty_ordered: 1, 
      unit_cost_ex_tax: "", 
      tax_rate_percent: 0 
    }]);
  };

  const handleRemoveLine = (index) => {
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...lines];
    const line = { ...newLines[index], [field]: value };

    // Auto-fill details if item changes
    if (field === "price_list_item_id") {
      const item = availableItems.find(i => i.id === value);
      if (item) {
        line.description = item.item + (item.description ? ` - ${item.description}` : "");
        line.unit_cost_ex_tax = item.unit_cost || item.price || ""; // Best guess at cost
      }
    }

    newLines[index] = line;
    setLines(newLines);
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => {
      const qty = parseFloat(line.qty_ordered) || 0;
      const cost = parseFloat(line.unit_cost_ex_tax) || 0;
      return sum + (qty * cost);
    }, 0);
  };

  const createPOMutation = useMutation({
    mutationFn: async () => {
      if (!supplier) throw new Error("No supplier selected");
      
      const locationName = locations.find(l => l.id === deliveryLocationId)?.name || "";

      // 1. Create Purchase Order
      const po = await base44.entities.PurchaseOrder.create({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        delivery_location_id: deliveryLocationId || null,
        delivery_location_name: locationName,
        status: "draft",
        po_number: poNumber || null,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes,
        total_amount_ex_tax: calculateTotal(),
        // Simple tax calc could be added here if needed
      });

      // 2. Create Lines
      const validLines = lines.filter(l => l.price_list_item_id && l.qty_ordered > 0);
      
      // Use parallel creation for lines
      await Promise.all(validLines.map(line => {
        const qty = parseFloat(line.qty_ordered) || 0;
        const cost = parseFloat(line.unit_cost_ex_tax) || 0;
        const total = qty * cost;

        return base44.entities.PurchaseOrderLine.create({
          purchase_order_id: po.id,
          price_list_item_id: line.price_list_item_id,
          description: line.description || "",
          qty_ordered: qty,
          qty_received: 0,
          unit_cost_ex_tax: cost,
          tax_rate_percent: parseFloat(line.tax_rate_percent) || 0,
          total_line_ex_tax: total
        });
      }));

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["purchase-orders-by-supplier", supplier?.id]);
      toast.success("Purchase Order created successfully");
      onClose();
    },
    onError: (error) => {
      console.error("Failed to create PO:", error);
      toast.error("Failed to create Purchase Order");
    }
  });

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order - {supplier.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Delivery Location</Label>
              <Select value={deliveryLocationId} onValueChange={setDeliveryLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name} ({loc.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PO Number (Optional)</Label>
              <Input 
                value={poNumber} 
                onChange={(e) => setPoNumber(e.target.value)} 
                placeholder="e.g. PO-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Order Date</Label>
              <Input 
                type="date" 
                value={orderDate} 
                onChange={(e) => setOrderDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input 
                type="date" 
                value={expectedDate} 
                onChange={(e) => setExpectedDate(e.target.value)} 
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Shipping instructions, etc."
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Order Items</Label>
              <Button variant="outline" size="sm" onClick={handleAddLine}>
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Item</TableHead>
                    <TableHead className="w-[25%]">Description</TableHead>
                    <TableHead className="w-[15%]">Qty</TableHead>
                    <TableHead className="w-[15%]">Unit Cost</TableHead>
                    <TableHead className="w-[10%]">Total</TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select 
                          value={line.price_list_item_id} 
                          onValueChange={(val) => handleLineChange(index, "price_list_item_id", val)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableItems.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.item} {item.sku ? `(${item.sku})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input 
                          value={line.description} 
                          onChange={(e) => handleLineChange(index, "description", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0"
                          value={line.qty_ordered} 
                          onChange={(e) => handleLineChange(index, "qty_ordered", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={line.unit_cost_ex_tax} 
                          onChange={(e) => handleLineChange(index, "unit_cost_ex_tax", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        ${((parseFloat(line.qty_ordered) || 0) * (parseFloat(line.unit_cost_ex_tax) || 0)).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        No items added yet. Click "Add Line" to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end mt-2">
              <div className="text-lg font-semibold">
                Total: ${calculateTotal().toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => createPOMutation.mutate()} 
            disabled={createPOMutation.isPending || lines.length === 0}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {createPOMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}