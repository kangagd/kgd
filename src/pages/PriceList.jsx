import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, DollarSign, Plus, Pencil, Trash2, PackagePlus, PackageMinus, AlertCircle, Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PriceListItemForm from "../components/pricelist/PriceListItemForm";
import StockAdjustmentModal from "../components/pricelist/StockAdjustmentModal";

const categoryColors = {
  "Service": "bg-blue-100 text-blue-800",
  "Motor": "bg-purple-100 text-purple-800",
  "Remotes/Accessories": "bg-green-100 text-green-800",
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
    queryFn: () => base44.entities.PriceListItem.list('category'),
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

  const filteredItems = priceItems.filter(item => {
    const matchesSearch = 
      item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "low" && item.stock_level <= item.min_stock_level) ||
      (stockFilter === "out" && item.stock_level === 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const categories = ["Service", "Motor", "Remotes/Accessories"];
  const isAdmin = user?.role === 'admin';
  const lowStockCount = priceItems.filter(item => item.stock_level <= item.min_stock_level && item.stock_level > 0).length;
  const outOfStockCount = priceItems.filter(item => item.stock_level === 0).length;

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
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleStockAdjust = (item) => {
    setAdjustingStock(item);
  };

  if (showForm) {
    return (
      <PriceListItemForm
        item={editingItem}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingItem(null);
        }}
        isSubmitting={createItemMutation.isPending || updateItemMutation.isPending}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-slate-900">Price List</h1>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
          <p className="text-slate-500">Quick reference for pricing and products</p>
        </div>

        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="mb-6 flex gap-3">
            {lowStockCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
                className={`${stockFilter === "low" ? "bg-amber-50 border-amber-300" : ""}`}
              >
                <AlertCircle className="w-4 h-4 mr-2 text-amber-600" />
                <span className="text-amber-900">{lowStockCount} Low Stock</span>
              </Button>
            )}
            {outOfStockCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setStockFilter(stockFilter === "out" ? "all" : "out")}
                className={`${stockFilter === "out" ? "bg-red-50 border-red-300" : ""}`}
              >
                <Package className="w-4 h-4 mr-2 text-red-600" />
                <span className="text-red-900">{outOfStockCount} Out of Stock</span>
              </Button>
            )}
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search items, descriptions, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-12 text-center">
            <Search className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No items found</h3>
            <p className="text-slate-500">Try adjusting your search</p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filteredItems.map((item) => {
              const isLowStock = item.stock_level <= item.min_stock_level && item.stock_level > 0;
              const isOutOfStock = item.stock_level === 0;

              return (
                <Card key={item.id} className={`hover:shadow-md transition-shadow ${isOutOfStock ? 'border-red-300' : isLowStock ? 'border-amber-300' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={categoryColors[item.category] || "bg-slate-100 text-slate-800"}>
                            {item.category}
                          </Badge>
                          {!item.in_inventory && (
                            <Badge variant="outline" className="text-slate-500">Not in stock</Badge>
                          )}
                          {isOutOfStock && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <Package className="w-3 h-3 mr-1" />
                              Out of Stock
                            </Badge>
                          )}
                          {isLowStock && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Low Stock
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-1">{item.item}</h3>
                        {item.description && (
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-slate-500 mt-2 italic">{item.notes}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-slate-600">
                            Stock: <span className={`font-semibold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                              {item.stock_level}
                            </span>
                          </span>
                          <span className="text-slate-500">Min: {item.min_stock_level}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-orange-600">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStockAdjust(item)}
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Adjust Stock"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <StockAdjustmentModal
        item={adjustingStock}
        open={!!adjustingStock}
        onClose={() => setAdjustingStock(null)}
      />
    </div>
  );
}