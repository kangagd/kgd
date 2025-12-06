import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { exToGstAmount, exToInc } from "@/components/gst";

export default function SupplierPurchaseOrderModal({ open, onClose, supplier, purchaseOrderToEdit }) {
  const queryClient = useQueryClient();
  const [poNumber, setPoNumber] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [fulfilmentMethod, setFulfilmentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [itemOpenStates, setItemOpenStates] = useState({});
  const [linesLoaded, setLinesLoaded] = useState(false);

  const { data: existingLines = [], isLoading: isLoadingLines } = useQuery({
    queryKey: ["purchase-order-lines", purchaseOrderToEdit?.id],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ purchase_order_id: purchaseOrderToEdit.id }),
    enabled: !!purchaseOrderToEdit && open,
  });

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
      if (purchaseOrderToEdit) {
        setPoNumber(purchaseOrderToEdit.po_number || "");
        setOrderDate(purchaseOrderToEdit.order_date ? format(new Date(purchaseOrderToEdit.order_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setExpectedDate(purchaseOrderToEdit.expected_date ? format(new Date(purchaseOrderToEdit.expected_date), "yyyy-MM-dd") : "");
        setDeliveryLocationId(purchaseOrderToEdit.delivery_location_id || "");
        setFulfilmentMethod(purchaseOrderToEdit.fulfilment_method || "");
        setNotes(purchaseOrderToEdit.notes || "");
        setLinesLoaded(false);
        // Lines will be set via existingLines effect
      } else {
        setPoNumber("");
        setOrderDate(format(new Date(), "yyyy-MM-dd"));
        setExpectedDate("");
        
        // Try to find default location immediately
        const defaultLoc = locations.find(l => 
          (l.address || "").includes("866 Bourke") || 
          (l.name || "").includes("866 Bourke")
        );
        setDeliveryLocationId(defaultLoc ? defaultLoc.id : "");
        
        // Default fulfilment method from supplier
        if (supplier?.fulfilment_preference === 'pickup' || supplier?.fulfilment_preference === 'delivery') {
            setFulfilmentMethod(supplier.fulfilment_preference);
        } else {
            setFulfilmentMethod("delivery");
        }
  
        setNotes("");
        setItemOpenStates({});
        setLines([{ 
          price_list_item_id: "", 
          description: "", 
          qty_ordered: 1, 
          unit_cost_ex_tax: "", 
          tax_rate_percent: 0 
        }]);
      }
    }
  }, [open, supplier, purchaseOrderToEdit]);

  // Load lines for editing
  useEffect(() => {
    if (open && purchaseOrderToEdit && !linesLoaded && !isLoadingLines) {
       setLines(existingLines.map(l => ({
         ...l,
         qty_ordered: l.qty_ordered, // ensure it's accessible
         // keep id
       })));
       setLinesLoaded(true);
    }
  }, [open, purchaseOrderToEdit, existingLines, linesLoaded, isLoadingLines]);

  // Attempt to set default location if locations load after modal opens (only for create)
  useEffect(() => {
    if (open && !purchaseOrderToEdit && locations.length > 0) {
      setDeliveryLocationId(prev => {
        if (prev) return prev;
        const defaultLoc = locations.find(l => 
          (l.address || "").includes("866 Bourke") || 
          (l.name || "").includes("866 Bourke")
        );
        return defaultLoc ? defaultLoc.id : prev;
      });
    }
  }, [locations, open, purchaseOrderToEdit]);

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

  const savePOMutation = useMutation({
    mutationFn: async () => {
      if (!supplier) throw new Error("No supplier selected");
      
      const locationName = locations.find(l => l.id === deliveryLocationId)?.name || "";
      const poData = {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        delivery_location_id: deliveryLocationId || null,
        delivery_location_name: locationName,
        status: purchaseOrderToEdit?.status || "draft",
        po_number: poNumber || null,
        order_date: orderDate,
        expected_date: expectedDate || null,
        fulfilment_method: fulfilmentMethod || null,
        notes: notes,
        total_amount_ex_tax: calculateTotal(),
      };

      let poId;

      if (purchaseOrderToEdit) {
         await base44.entities.PurchaseOrder.update(purchaseOrderToEdit.id, poData);
         poId = purchaseOrderToEdit.id;
         
         // Handle Lines
         const currentLineIds = new Set(lines.filter(l => l.id).map(l => l.id));
         const linesToDelete = existingLines.filter(l => !currentLineIds.has(l.id));
         
         await Promise.all(linesToDelete.map(l => base44.entities.PurchaseOrderLine.delete(l.id)));
         
         const validLines = lines.filter(l => l.price_list_item_id && l.qty_ordered > 0);
         
         await Promise.all(validLines.map(line => {
            const qty = parseFloat(line.qty_ordered) || 0;
            const cost = parseFloat(line.unit_cost_ex_tax) || 0;
            const total = qty * cost;
            
            const lineData = {
              purchase_order_id: poId,
              price_list_item_id: line.price_list_item_id,
              description: line.description || "",
              qty_ordered: qty,
              unit_cost_ex_tax: cost,
              tax_rate_percent: parseFloat(line.tax_rate_percent) || 0,
              total_line_ex_tax: total
            };

            if (line.id) {
                return base44.entities.PurchaseOrderLine.update(line.id, lineData);
            } else {
                return base44.entities.PurchaseOrderLine.create({
                    ...lineData,
                    qty_received: 0,
                });
            }
         }));

      } else {
          const po = await base44.entities.PurchaseOrder.create(poData);
          poId = po.id;

          const validLines = lines.filter(l => l.price_list_item_id && l.qty_ordered > 0);
          await Promise.all(validLines.map(line => {
            const qty = parseFloat(line.qty_ordered) || 0;
            const cost = parseFloat(line.unit_cost_ex_tax) || 0;
            const total = qty * cost;
    
            return base44.entities.PurchaseOrderLine.create({
              purchase_order_id: poId,
              price_list_item_id: line.price_list_item_id,
              description: line.description || "",
              qty_ordered: qty,
              qty_received: 0,
              unit_cost_ex_tax: cost,
              tax_rate_percent: parseFloat(line.tax_rate_percent) || 0,
              total_line_ex_tax: total
            });
          }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["purchase-orders-by-supplier", supplier?.id]);
      queryClient.invalidateQueries(["purchase-order-lines", purchaseOrderToEdit?.id]);
      toast.success(`Purchase Order ${purchaseOrderToEdit ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error) => {
      console.error("Failed to save PO:", error);
      toast.error(`Failed to ${purchaseOrderToEdit ? 'update' : 'create'} Purchase Order`);
    }
  });

  const deletePOMutation = useMutation({
      mutationFn: async () => {
          if (!purchaseOrderToEdit) return;
          // Delete lines first
          const linesToDelete = await base44.entities.PurchaseOrderLine.filter({ purchase_order_id: purchaseOrderToEdit.id });
          await Promise.all(linesToDelete.map(l => base44.entities.PurchaseOrderLine.delete(l.id)));
          await base44.entities.PurchaseOrder.delete(purchaseOrderToEdit.id);
      },
      onSuccess: () => {
          queryClient.invalidateQueries(["purchase-orders-by-supplier", supplier?.id]);
          toast.success("Purchase Order deleted");
          onClose();
      },
      onError: (error) => {
          console.error("Failed to delete PO:", error);
          toast.error("Failed to delete Purchase Order");
      }
  });

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="modal-container max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="modal-title text-lg font-semibold text-gray-900">
              {purchaseOrderToEdit ? 'Edit Purchase Order' : 'Create Purchase Order'} - {supplier.name}
          </DialogTitle>
        </DialogHeader>

        <div className="modal-panel py-4 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Delivery Location</Label>
              <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={locationOpen}
                    className="w-full h-[44px] justify-between text-[15px] font-normal"
                  >
                    {deliveryLocationId
                      ? locations.find((loc) => loc.id === deliveryLocationId)?.name
                      : "Select location..."}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 z-[100]">
                  <Command>
                    <CommandInput placeholder="Search location..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>No location found.</CommandEmpty>
                      <CommandGroup>
                        {locations.map((loc) => (
                          <CommandItem
                            key={loc.id}
                            value={`${loc.name} ${loc.id}`.toLowerCase()}
                            keywords={[loc.name]}
                            onSelect={() => {
                              setDeliveryLocationId(loc.id);
                              setLocationOpen(false);
                            }}
                            className="text-xs cursor-pointer !opacity-100 !pointer-events-auto"
                            disabled={false}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3",
                                deliveryLocationId === loc.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {loc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">PO Number (Optional)</Label>
              <Input 
                value={poNumber} 
                onChange={(e) => setPoNumber(e.target.value)} 
                placeholder="e.g. PO-2024-001"
                className="input-sm w-full h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Order Date</Label>
              <Input 
                type="date" 
                value={orderDate} 
                onChange={(e) => setOrderDate(e.target.value)} 
                className="input-sm w-full h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Expected Date</Label>
              <Input 
                type="date" 
                value={expectedDate} 
                onChange={(e) => setExpectedDate(e.target.value)} 
                className="input-sm w-full h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Fulfilment Method</Label>
              <Select value={fulfilmentMethod} onValueChange={setFulfilmentMethod}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Delivery from Supplier</SelectItem>
                  <SelectItem value="pickup">Pickup from Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label className="text-xs font-medium text-gray-700">Notes</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Shipping instructions, etc."
                className="textarea-sm w-full min-h-[80px]"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold text-gray-900">Order Items</Label>
              <Button variant="outline" size="sm" onClick={handleAddLine} className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Line
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow className="bg-gray-50/50 hover:bg-transparent border-b">
                    <TableHead className="w-[30%] h-9 text-[11px] uppercase">Item</TableHead>
                    <TableHead className="w-[25%] h-9 text-[11px] uppercase">Description</TableHead>
                    <TableHead className="w-[15%] h-9 text-[11px] uppercase">Qty</TableHead>
                    <TableHead className="w-[15%] h-9 text-[11px] uppercase">Unit Cost (ex GST)</TableHead>
                    <TableHead className="w-[10%] h-9 text-[11px] uppercase">Total (ex GST)</TableHead>
                    <TableHead className="w-[5%] h-9"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index} className="hover:bg-gray-50 border-b last:border-0">
                      <TableCell className="p-2">
                        <Popover 
                            open={itemOpenStates[index] || false} 
                            onOpenChange={(open) => setItemOpenStates({ ...itemOpenStates, [index]: open })}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={itemOpenStates[index] || false}
                              className="w-full h-8 justify-between text-xs font-normal px-2"
                            >
                              {line.price_list_item_id
                                ? (() => {
                                    const item = availableItems.find((i) => i.id === line.price_list_item_id);
                                    return item ? item.item : "Select item";
                                  })()
                                : "Select item"}
                              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
                            <Command>
                              <CommandInput placeholder="Search item..." className="h-8 text-xs" />
                              <CommandList>
                                <CommandEmpty>No item found.</CommandEmpty>
                                <CommandGroup>
                                  {availableItems.map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={`${item.item} ${item.sku || ''} ${item.id}`.toLowerCase()}
                                      keywords={[item.item, item.sku || '']}
                                      onSelect={() => {
                                        handleLineChange(index, "price_list_item_id", item.id);
                                        setItemOpenStates({ ...itemOpenStates, [index]: false });
                                      }}
                                      className="text-xs cursor-pointer !opacity-100 !pointer-events-auto"
                                      disabled={false}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-3 w-3",
                                          line.price_list_item_id === item.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{item.item}</span>
                                        {item.sku && <span className="text-xs text-muted-foreground">{item.sku}</span>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={line.description} 
                          onChange={(e) => handleLineChange(index, "description", e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          type="number" 
                          min="0"
                          value={line.qty_ordered} 
                          onChange={(e) => handleLineChange(index, "qty_ordered", e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={line.unit_cost_ex_tax} 
                          onChange={(e) => handleLineChange(index, "unit_cost_ex_tax", e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                        {line.unit_cost_ex_tax && !isNaN(parseFloat(line.unit_cost_ex_tax)) && (
                            <div className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                                +GST: ${exToGstAmount(parseFloat(line.unit_cost_ex_tax)).toFixed(2)}
                            </div>
                        )}
                      </TableCell>
                      <TableCell className="p-2 font-medium text-right pr-4">
                        <div>${((parseFloat(line.qty_ordered) || 0) * (parseFloat(line.unit_cost_ex_tax) || 0)).toFixed(2)}</div>
                        {line.unit_cost_ex_tax && line.qty_ordered && (
                            <div className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                                Inc: ${((parseFloat(line.qty_ordered) || 0) * exToInc(parseFloat(line.unit_cost_ex_tax))).toFixed(2)}
                            </div>
                        )}
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-6 text-xs">
                        No items added yet. Click "Add Line" to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end mt-2">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  Total (ex GST): ${calculateTotal().toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Total (inc GST): ${exToInc(calculateTotal()).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4 mt-2 flex justify-between items-center w-full">
            <div>
                {purchaseOrderToEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (window.confirm("Are you sure you want to delete this purchase order?")) {
                                deletePOMutation.mutate();
                            }
                        }}
                        disabled={deletePOMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                        {deletePOMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Delete Order
                    </Button>
                )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button 
                size="sm"
                onClick={() => savePOMutation.mutate()} 
                disabled={savePOMutation.isPending || lines.length === 0}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-medium"
              >
                {savePOMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                {purchaseOrderToEdit ? 'Update Order' : 'Create Purchase Order'}
              </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}