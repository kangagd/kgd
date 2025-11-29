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
import { Search } from "lucide-react";

export default function AddVehicleStockModal({ open, onClose, vehicleId }) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [search, setSearch] = useState("");
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
      const response = await base44.functions.invoke('manageVehicleStock', {
        action: 'adjust',
        data: {
          vehicle_id: vehicleId,
          product_id: selectedProduct,
          new_quantity: parseInt(quantity),
          reason: "Initial stock addition"
        }
      });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      toast.success("Item added to vehicle");
      onClose();
      setSelectedProduct("");
      setQuantity(0);
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    if (quantity < 0) {
      toast.error("Quantity must be non-negative");
      return;
    }
    addMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Item to Vehicle</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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
              {filteredProducts.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No products found</div>
              )}
            </div>
            {selectedProduct && (
              <div className="text-xs text-green-600 font-medium">
                Selected: {products.find(p => p.id === selectedProduct)?.item}
              </div>
            )}
          </div>

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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={addMutation.isPending || !selectedProduct}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-black"
          >
            {addMutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}