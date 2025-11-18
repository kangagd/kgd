
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, TrendingDown, AlertTriangle, Package, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PriceListItemForm from "../components/pricelist/PriceListItemForm";
import StockAdjustmentModal from "../components/pricelist/StockAdjustmentModal";

const categoryColors = {
  "Service": "bg-purple-100 text-purple-700 border-purple-200",
  "Motor": "bg-[#FEF8C8] text-slate-700 border-slate-200",
  "Remotes/Accessories": "bg-green-100 text-green-700 border-green-200"
};

export default function PriceList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustingStock, setAdjustingStock] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: priceItems = [], isLoading } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list()
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => base44.entities.PriceListItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      setShowForm(false);
      setEditingItem(null);
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PriceListItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      setShowForm(false);
      setEditingItem(null);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.PriceListItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
    }
  });

  const filteredItems = priceItems.filter((item) => {
    const matchesSearch = 
      item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "low" && item.in_inventory && item.stock_level <= item.min_stock_level && item.stock_level > 0) ||
      (stockFilter === "out" && item.in_inventory && item.stock_level === 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  // The categories variable is now dynamically created from priceItems or hardcoded in TabsList
  // The outline specifies specific tabs, so the dynamic categories variable is not fully used for the TabsList, but kept for general reference if needed.
  // const categories = ["all", ...new Set(priceItems.map(item => item.category))]; 
  const isAdmin = user?.role === 'admin';
  const lowStockCount = priceItems.filter(item => item.in_inventory && item.stock_level <= item.min_stock_level && item.stock_level > 0).length;
  const outOfStockCount = priceItems.filter(item => item.in_inventory && item.stock_level === 0).length;

  const handleSubmit = (data) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleAdjustStock = (item) => {
    setAdjustingStock(item);
  };

  if (showForm) {
    return (
      <div className="p-4 md:p-8 bg-[#FFFDEF] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <PriceListItemForm
            item={editingItem}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
            isSubmitting={createItemMutation.isPending || updateItemMutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-[#FFFDEF] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Price List</h1>
            <p className="text-[hsl(25,8%,45%)] mt-2">Manage products and pricing</p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#fae008] text-black hover:bg-[#e5d007] active:bg-[#d4c006] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Item
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[hsl(25,8%,55%)]" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 border-2 border-[hsl(32,15%,88%)] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 text-base rounded-xl"
            />
          </div>

          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList className="w-full grid grid-cols-4 h-11">
              <TabsTrigger value="all" className="font-semibold">All</TabsTrigger>
              <TabsTrigger value="Service" className="font-semibold">Service</TabsTrigger>
              <TabsTrigger value="Motor" className="font-semibold">Motor</TabsTrigger>
              <TabsTrigger value="Remotes/Accessories" className="font-semibold">Accessories</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button
              variant={stockFilter === "all" ? "default" : "outline"}
              onClick={() => setStockFilter("all")}
              className={stockFilter === "all" ? "bg-[#fae008] text-black hover:bg-[#e5d007]" : ""}
            >
              All Stock
            </Button>
            <Button
              variant={stockFilter === "low" ? "default" : "outline"}
              onClick={() => setStockFilter("low")}
              className={stockFilter === "low" ? "bg-[#fae008] text-black hover:bg-[#e5d007]" : ""}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Low ({lowStockCount})
            </Button>
            <Button
              variant={stockFilter === "out" ? "default" : "outline"}
              onClick={() => setStockFilter("out")}
              className={stockFilter === "out" ? "bg-[#fae008] text-black hover:bg-[#e5d007]" : ""}
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Out ({outOfStockCount})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-2 border-[hsl(32,15%,88%)] rounded-2xl">
                <CardContent className="p-4 md:p-6">
                  <div className="h-6 bg-[hsl(32,15%,88%)] rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-[hsl(32,15%,88%)] rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-12 text-center border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <Package className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
            <h3 className="text-lg font-bold text-[hsl(25,10%,12%)] mb-2">No items found</h3>
            <p className="text-[hsl(25,8%,45%)]">Try adjusting your filters or add a new item</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="border-2 border-[hsl(32,15%,88%)] hover:border-[#fae008] hover:shadow-lg transition-all rounded-2xl"
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-lg font-bold text-[hsl(25,10%,12%)]">{item.item}</h3>
                        {item.category && (
                          <Badge className={`${categoryColors[item.category]} font-semibold border-2`}>
                            {item.category}
                          </Badge>
                        )}
                        {item.in_inventory && item.stock_level <= item.min_stock_level && item.stock_level > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-semibold border-2">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Low Stock
                          </Badge>
                        )}
                        {item.in_inventory && item.stock_level === 0 && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold border-2">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            Out of Stock
                          </Badge>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-sm text-[hsl(25,8%,45%)] mb-2">{item.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                          <span className="text-lg font-bold text-[hsl(25,10%,12%)]">${item.price.toFixed(2)}</span>
                        </div>
                        {item.in_inventory && (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                            <span className="text-[hsl(25,8%,45%)]">
                              Stock: <span className="font-semibold">{item.stock_level}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          className="h-10 w-10"
                          title="Edit Item"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {item.in_inventory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAdjustStock(item)}
                            className="h-10 w-10"
                            title="Adjust Stock"
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="h-10 w-10 text-red-600"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {adjustingStock && (
        <StockAdjustmentModal
          item={adjustingStock}
          onClose={() => setAdjustingStock(null)}
        />
      )}
    </div>
  );
}
