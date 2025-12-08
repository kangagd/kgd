import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Archive, Truck } from "lucide-react";
import { toast } from "sonner";
import PartsHardwareFormModal from "../components/partshardware/PartsHardwareFormModal";
import AssignPartsHardwareModal from "../components/partshardware/AssignPartsHardwareModal";

export default function PartsHardwareAdmin() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [assigningItem, setAssigningItem] = useState(null);

  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['parts-hardware'],
    queryFn: () => base44.entities.PartsHardwareItem.list('name'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PartsHardwareItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-hardware']);
      setShowForm(false);
      toast.success("Item created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PartsHardwareItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-hardware']);
      setEditingItem(null);
      toast.success("Item updated");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => base44.entities.PartsHardwareItem.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-hardware']);
      toast.success("Item archived");
    },
  });

  const filteredItems = items.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase())
  );

  const activeItems = filteredItems.filter(c => c.is_active !== false);
  const archivedItems = filteredItems.filter(c => c.is_active === false);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts & Hardware Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Manage overhead items (non-stock)</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#FAE008] hover:bg-[#E5CF07] text-black">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Items</h2>
            {activeItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No items found. Add one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeItems.map(item => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          {item.category && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {item.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div>
                          Default Qty: <span className="font-medium">{item.default_quantity_expected || 1}</span>
                        </div>
                        {item.notes && (
                          <div className="text-xs text-gray-500 italic">{item.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssigningItem(item)}
                          className="flex-1"
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archiveMutation.mutate(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Archive className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {archivedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-4">Archived</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {archivedItems.map(item => (
                  <Card key={item.id}>
                    <CardHeader>
                      <CardTitle className="text-lg text-gray-500">{item.name}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <PartsHardwareFormModal
        open={showForm || !!editingItem}
        onClose={() => {
          setShowForm(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSubmit={(data) => {
          if (editingItem) {
            updateMutation.mutate({ id: editingItem.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isLoading || updateMutation.isLoading}
      />

      <AssignPartsHardwareModal
        open={!!assigningItem}
        onClose={() => setAssigningItem(null)}
        item={assigningItem}
        vehicles={vehicles}
      />
    </div>
  );
}