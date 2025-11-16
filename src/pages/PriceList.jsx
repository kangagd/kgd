import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PriceListItemForm from "../components/pricelist/PriceListItemForm";

const categoryColors = {
  "Service": "bg-blue-100 text-blue-800",
  "Motor": "bg-purple-100 text-purple-800",
  "Remotes/Accessories": "bg-green-100 text-green-800",
};

export default function PriceList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
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
    
    return matchesSearch && matchesCategory;
  });

  const categories = ["Service", "Motor", "Remotes/Accessories"];

  const isAdmin = user?.role === 'admin';

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
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={categoryColors[item.category] || "bg-slate-100 text-slate-800"}>
                          {item.category}
                        </Badge>
                        {!item.in_inventory && (
                          <Badge variant="outline" className="text-slate-500">Not in stock</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1">{item.item}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic">{item.notes}</p>
                      )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}