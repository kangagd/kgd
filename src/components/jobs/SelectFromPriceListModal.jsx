import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Package, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SelectFromPriceListModal({ open, onClose, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const { data: priceListItems = [], isLoading } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.filter({ is_active: true }),
    enabled: open,
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
    enabled: open,
  });

  // Calculate total stock per item
  const stockByItemId = {};
  inventoryQuantities.forEach(iq => {
    if (!stockByItemId[iq.price_list_item_id]) {
      stockByItemId[iq.price_list_item_id] = 0;
    }
    stockByItemId[iq.price_list_item_id] += (iq.quantity || 0);
  });

  const categories = ["all", "Accessories", "Arms", "Door", "Gate", "Motor", "Posts", "Rails", "Remotes", "Service", "Springs"];

  const filteredItems = priceListItems.filter(item => {
    const matchesSearch = !searchTerm || 
      item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleSelect = (item) => {
    onSelect({
      label: item.item,
      type: 'part',
      price_list_item_id: item.id,
      qty: 1
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#111827]">
            Select from Price List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Category Filter */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-shrink-0">
            <TabsList className="w-full overflow-x-auto">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-[#9CA3AF]">
                <Package className="w-12 h-12 mx-auto mb-2 text-[#E5E7EB]" />
                <p className="text-sm">No items found</p>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="border border-[#E5E7EB] rounded-lg p-3 hover:bg-[#F9FAFB] hover:border-[#FAE008] transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#111827] text-[14px]">
                          {item.item}
                        </div>
                        {item.description && (
                          <div className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="bg-slate-100 text-slate-700 text-[10px] border-0">
                            {item.category}
                          </Badge>
                          {item.sku && (
                            <span className="text-[11px] text-[#9CA3AF]">SKU: {item.sku}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[14px] font-bold text-[#111827]">
                          ${item.price?.toFixed(2)}
                        </div>
                        {stockByItemId[item.id] !== undefined && (
                          <div className="text-[11px] text-[#6B7280] mt-0.5">
                            Stock: {stockByItemId[item.id] || 0}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedItem && (
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#111827]">{selectedItem.item}</div>
                <div className="text-[12px] text-[#6B7280]">${selectedItem.price?.toFixed(2)} each</div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="quantity" className="text-[13px] font-medium text-[#6B7280]">Quantity:</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 border-2 border-slate-300"
                />
              </div>
              <Button
                onClick={handleConfirm}
                className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
              >
                Add Item
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}