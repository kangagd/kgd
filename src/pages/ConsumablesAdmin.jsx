import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Archive, Truck } from "lucide-react";
import { toast } from "sonner";
import ConsumableFormModal from "../components/consumables/ConsumableFormModal";
import AssignConsumableModal from "../components/consumables/AssignConsumableModal";

export default function ConsumablesAdmin() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingConsumable, setEditingConsumable] = useState(null);
  const [assigningConsumable, setAssigningConsumable] = useState(null);

  const queryClient = useQueryClient();

  const { data: consumables = [], isLoading } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => base44.entities.ConsumableItem.list('name'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ConsumableItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['consumables']);
      setShowForm(false);
      toast.success("Consumable created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ConsumableItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['consumables']);
      setEditingConsumable(null);
      toast.success("Consumable updated");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => base44.entities.ConsumableItem.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['consumables']);
      toast.success("Consumable archived");
    },
  });

  const filteredConsumables = consumables.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase())
  );

  const activeConsumables = filteredConsumables.filter(c => c.is_active !== false);
  const archivedConsumables = filteredConsumables.filter(c => c.is_active === false);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consumables Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Manage overhead consumables (non-stock items)</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#FAE008] hover:bg-[#E5CF07] text-black">
          <Plus className="w-4 h-4 mr-2" />
          Add Consumable
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search consumables..."
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Consumables</h2>
            {activeConsumables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  No consumables found. Add one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeConsumables.map(consumable => (
                  <Card key={consumable.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{consumable.name}</CardTitle>
                          {consumable.category && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {consumable.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div>
                          Default Qty: <span className="font-medium">{consumable.default_quantity_expected || 1}</span>
                        </div>
                        {consumable.notes && (
                          <div className="text-xs text-gray-500 italic">{consumable.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssigningConsumable(consumable)}
                          className="flex-1"
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingConsumable(consumable)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archiveMutation.mutate(consumable.id)}
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

          {archivedConsumables.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-4">Archived</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {archivedConsumables.map(consumable => (
                  <Card key={consumable.id}>
                    <CardHeader>
                      <CardTitle className="text-lg text-gray-500">{consumable.name}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ConsumableFormModal
        open={showForm || !!editingConsumable}
        onClose={() => {
          setShowForm(false);
          setEditingConsumable(null);
        }}
        consumable={editingConsumable}
        onSubmit={(data) => {
          if (editingConsumable) {
            updateMutation.mutate({ id: editingConsumable.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isLoading || updateMutation.isLoading}
      />

      <AssignConsumableModal
        open={!!assigningConsumable}
        onClose={() => setAssigningConsumable(null)}
        consumable={assigningConsumable}
        vehicles={vehicles}
      />
    </div>
  );
}