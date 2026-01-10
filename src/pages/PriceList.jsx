import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, DollarSign, Plus, Pencil, Trash2, PackagePlus, PackageMinus, AlertCircle, Package, Warehouse } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import PriceListItemForm from "../components/pricelist/PriceListItemForm";
import StockAdjustmentModal from "../components/pricelist/StockAdjustmentModal";
import PriceListCard from "../components/pricelist/PriceListCard";
import MoveStockModal from "../components/inventory/MoveStockModal";
import { LOCATION_TYPE } from "@/components/domain/inventoryConfig";
import { useMemo } from "react";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";


export default function PriceList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showStockOnly, setShowStockOnly] = useState(false);
  const [stockFilter, setStockFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustingStock, setAdjustingStock] = useState(null);
  const [movingStock, setMovingStock] = useState(null);
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
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("name"),
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ["inventory-quantities"],
    queryFn: async () => {
      // Fetch all quantities without filtering to get complete data
      const allQuantities = await base44.entities.InventoryQuantity.list("id");
      return allQuantities;
    },
  });

  const { data: inventoryLocations = [] } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: () => base44.entities.InventoryLocation.filter({ is_active: true }),
  });

  const inventorySummaryByItem = useMemo(() => {
    const map = {};
    for (const iq of inventoryQuantities) {
      if (!iq.price_list_item_id) continue;
      if (!map[iq.price_list_item_id]) {
        map[iq.price_list_item_id] = {
          total_on_hand: 0,
          total_in_vehicles: 0,
          total_in_warehouse: 0,
        };
      }
      const summary = map[iq.price_list_item_id];
      summary.total_on_hand += iq.quantity || 0;
      if (iq.location_type === LOCATION_TYPE.VEHICLE) {
        summary.total_in_vehicles += iq.quantity || 0;
      } else if (iq.location_type === LOCATION_TYPE.WAREHOUSE) {
        summary.total_in_warehouse += iq.quantity || 0;
      }
    }
    return map;
  }, [inventoryQuantities]);

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
    (stockFilter === "low" && item.stock_level <= item.min_stock_level && item.track_inventory !== false) ||
    (stockFilter === "out" && item.stock_level === 0 && item.track_inventory !== false);

    const matchesInventoryType = !showStockOnly || item.track_inventory !== false;

    return matchesSearch && matchesCategory && matchesStock && matchesInventoryType;
  });

  // Dynamically extract categories from loaded data
  const categories = React.useMemo(() => {
    const cats = [...new Set(priceItems.map(item => item.category).filter(Boolean))];
    return cats.sort();
  }, [priceItems]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isTechnician = user?.is_field_technician && !isAdminOrManager;
  const canModifyStock = isAdminOrManager || isTechnician;
  const canEditPriceList = isAdminOrManager;
  const lowStockCount = priceItems.filter((item) => item.stock_level <= item.min_stock_level && item.stock_level > 0 && item.track_inventory !== false).length;
  const outOfStockCount = priceItems.filter((item) => item.stock_level === 0 && item.track_inventory !== false).length;

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

  const handleMoveStock = (item) => {
    setMovingStock(item);
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
        canViewCosts={isAdminOrManager}
      />
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Price List</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage inventory and pricing</p>
          </div>
          {canEditPriceList && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>

        <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex gap-3 flex-wrap">
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

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="stock-only" 
              checked={showStockOnly} 
              onCheckedChange={setShowStockOnly} 
            />
            <label
              htmlFor="stock-only"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none text-gray-700"
            >
              Stock Items Only
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <Input
              placeholder="Search items, descriptions, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 border border-[#E5E7EB] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 w-full h-12 text-base rounded-lg"
            />
          </div>
          
          <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0 space-y-2">
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-full">
              <TabsList className="w-full justify-start min-w-max md:min-w-0">
                <TabsTrigger value="all" className="flex-1 whitespace-nowrap">All Categories</TabsTrigger>
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="flex-1 whitespace-nowrap">{cat}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            

          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
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
          <div className="grid gap-3">
            {filteredItems.map((item) => {
              // Get all quantities for this item from all locations
              const stockByLocation = inventoryQuantities
                .filter(q => q.price_list_item_id === item.id)
                .map(q => {
                  // Fallback to location object if location_name is missing
                  let locationName = q.location_name || 'Unknown';
                  if (!q.location_name && q.location_id) {
                    const location = inventoryLocations.find(l => l.id === q.location_id);
                    locationName = location?.name || 'Unknown';
                  }
                  return {
                    ...q,
                    location_name: locationName
                  };
                });

              return (
                <PriceListCard
                  key={item.id}
                  item={item}
                  isAdmin={canEditPriceList}
                  canModifyStock={canModifyStock}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStockAdjust={handleStockAdjust}
                  onMoveStock={handleMoveStock}
                  inventorySummary={inventorySummaryByItem[item.id]}
                  stockByLocation={stockByLocation}
                  locations={inventoryLocations}
                  canViewCosts={isAdminOrManager}
                />
              );
            })}
          </div>
        )}
      </div>

      <StockAdjustmentModal
        item={adjustingStock}
        open={!!adjustingStock}
        onClose={() => setAdjustingStock(null)}
        vehicles={vehicles}
        locations={inventoryLocations}
      />

      <MoveStockModal
        item={movingStock}
        isOpen={!!movingStock}
        onClose={() => setMovingStock(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
          setMovingStock(null);
        }}
      />
    </div>
  );
}