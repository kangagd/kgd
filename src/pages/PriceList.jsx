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
import PriceListCard from "../components/pricelist/PriceListCard";



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
    queryFn: () => base44.entities.PriceListItem.list('category')
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
    item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

    const matchesStock =
    stockFilter === "all" ||
    stockFilter === "low" && item.stock_level <= item.min_stock_level ||
    stockFilter === "out" && item.stock_level === 0;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const categories = ["Service", "Motor", "Remotes/Accessories"];
  const isAdmin = user?.role === 'admin';
  const lowStockCount = priceItems.filter((item) => item.stock_level <= item.min_stock_level && item.stock_level > 0).length;
  const outOfStockCount = priceItems.filter((item) => item.stock_level === 0).length;

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
    <div className="page-container overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
          <div>
            <h1 className="text-3xl font-bold text-[#111827] tracking-tight">Price List</h1>
            <p className="text-[#4B5563] mt-2.5">Manage inventory and pricing</p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto h-12 rounded-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Item
            </Button>
          )}
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
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[hsl(25,8%,55%)]" />
            <Input
              placeholder="Search items, descriptions, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-[hsl(32,15%,88%)] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 w-full"
            />
          </div>
          
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="card-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-6 bg-[hsl(32,15%,88%)] rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-[hsl(32,15%,88%)] rounded w-2/3"></div>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <Search className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
            <h3 className="text-lg font-semibold text-[hsl(25,10%,25%)] mb-2">No items found</h3>
            <p className="text-[hsl(25,8%,45%)]">Try adjusting your search</p>
          </Card>
        ) : (
          <div className="card-grid">
            {filteredItems.map((item) => (
              <PriceListCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStockAdjust={handleStockAdjust}
              />
            ))}
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