import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";

export default function AddVehicleStockModal({ open, onClose, vehicleId }) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [search, setSearch] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItemData, setNewItemData] = useState({
    item: "",
    category: "Tools",
    price: 0
  });

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('-item', 100) // Fetching top 100 for now
  });

  const filteredProducts = products.filter(p => 
    p.item.toLowerCase().includes(search.toLowerCase()) || 
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (isCreatingNew) {
        // Create new product and add to vehicle
        const response = await base44.functions.invoke('manageVehicleStock', {
          action: 'create_product_and_add',
          data: {
            vehicle_id: vehicleId,
            product_details: newItemData,
            initial_quantity: parseInt(quantity)
          }
        });
        if (response.data.error) throw new Error(response.data.error);
        return response.data;
      } else {
        // Existing product
        const response = await base44.functions.invoke('manageVehicleStock', {
          action: 'adjust',
          data: {
            vehicle_id: vehicleId,
            product_id: selectedProduct,
            new_quantity: parseInt(quantity),
            reason: "Stock addition"
          }
        });
        if (response.data.error) throw new Error(response.data.error);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] }); // Refresh product list
      toast.success(isCreatingNew ? "New item created and added" : "Item added to vehicle");
      handleClose();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleClose = () => {
    onClose();
    setSelectedProduct("");
    setQuantity(0);
    setIsCreatingNew(false);
    setNewItemData({ item: "", category: "Tools", price: 0 });
    setSearch("");
  };

  const handleSubmit = () => {
    if (isCreatingNew) {
      if (!newItemData.item) {
        toast.error("Item name is required");
        return;
      }
    } else {
      if (!selectedProduct) {
        toast.error("Please select a product");
        return;
      }
    }
    if (quantity < 0) {
      toast.error("Quantity must be non-negative");
      return;
    }
    addMutation.mutate();
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setNewItemData(prev => ({ ...prev, item: search }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isCreatingNew ? "Create & Add New Item" : "Add Item to Vehicle"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isCreatingNew ? (
            <div className="space-y-2">
              <Label>Product</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 mb-2"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {filteredProducts.map(product => (
                  <div 
                    key={product.id}
                    className={`p-2 text-sm cursor-pointer hover:bg-accent ${selectedProduct === product.id ? 'bg-accent font-medium' : ''}`}
                    onClick={() => setSelectedProduct(product.id)}
                  >
                    <div className="flex justify-between">
                      <span>{product.item}</span>
                      <span className="text-muted-foreground text-xs">{product.category}</span>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && search && (
                  <div 
                    className="p-3 text-center cursor-pointer hover:bg-accent text-blue-600 flex items-center justify-center gap-2"
                    onClick={handleCreateNew}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create "{search}"</span>
                  </div>
                )}
                {filteredProducts.length === 0 && !search && (
                  <div className="p-4 text-center text-sm text-muted-foreground">Start typing to search or create</div>
                )}
              </div>
              {/* Always show create button if search is not empty, even if results exist */}
              {search && filteredProducts.length > 0 && (
                 <Button variant="ghost" size="sm" className="w-full text-blue-600 mt-1" onClick={handleCreateNew}>
                    <Plus className="w-3 h-3 mr-1" /> Create new item "{search}"
                 </Button>
              )}

              {selectedProduct && (
                <div className="text-xs text-green-600 font-medium">
                  Selected: {products.find(p => p.id === selectedProduct)?.item}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 border rounded-md p-4 bg-slate-50">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input 
                  value={newItemData.item}
                  onChange={(e) => setNewItemData({...newItemData, item: e.target.value})}
                  placeholder="e.g. Hammer Drill"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={newItemData.category} 
                  onValueChange={(val) => setNewItemData({...newItemData, category: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Motor">Motor</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Remotes/Accessories">Remotes/Accessories</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsCreatingNew(false)} className="h-auto p-0 text-muted-foreground hover:text-foreground">
                 ← Back to search
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Initial Quantity</Label>
            <Input 
              type="number" 
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={addMutation.isPending || (!selectedProduct && !isCreatingNew)}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-black"
          >
            {addMutation.isPending ? "Saving..." : (isCreatingNew ? "Create & Add" : "Add Item")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}