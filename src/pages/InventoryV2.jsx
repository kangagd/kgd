import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as invApi from "@/components/api/inventoryV2Api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRightLeft, TrendingUp, Package } from "lucide-react";
import { toast } from "sonner";

export default function InventoryV2() {
  const queryClient = useQueryClient();
  const [showNewItem, setShowNewItem] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showConsume, setShowConsume] = useState(false);

  // Fetch data
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['inventoryItemsV2'],
    queryFn: () => base44.entities.InventoryItemV2.list('name')
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['inventoryBalances'],
    queryFn: () => base44.entities.InventoryBalance.list()
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['stockLocationsV2'],
    queryFn: () => base44.entities.StockLocationV2.filter({ is_active: true }, 'name')
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name')
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.filter({ status: { $ne: 'Lost' } }, '-created_date', 100)
  });

  // Create balance map
  const balanceMap = {};
  balances.forEach(b => {
    const key = `${b.inventory_item_v2_id}_${b.location_v2_id}`;
    balanceMap[key] = b.qty_on_hand || 0;
  });

  // Location map
  const locationMap = {};
  locations.forEach(l => {
    locationMap[l.id] = l.name;
  });

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: invApi.createStockItem,
    onSuccess: () => {
      queryClient.invalidateQueries(['inventoryItemsV2']);
      toast.success('Item created');
      setShowNewItem(false);
    },
    onError: (error) => toast.error(error.message)
  });

  const adjustMutation = useMutation({
    mutationFn: invApi.adjustBalance,
    onSuccess: () => {
      queryClient.invalidateQueries(['inventoryBalances']);
      toast.success('Balance adjusted');
      setShowAdjust(false);
    },
    onError: (error) => toast.error(error.message)
  });

  const moveMutation = useMutation({
    mutationFn: invApi.moveStock,
    onSuccess: () => {
      queryClient.invalidateQueries(['inventoryBalances']);
      toast.success('Stock moved');
      setShowMove(false);
    },
    onError: (error) => toast.error(error.message)
  });

  const consumeMutation = useMutation({
    mutationFn: invApi.consumeForProject,
    onSuccess: () => {
      queryClient.invalidateQueries(['inventoryBalances']);
      toast.success('Stock consumed');
      setShowConsume(false);
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory V2</h1>
          <p className="text-gray-600">Manage stock items and locations</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Stock Item</DialogTitle>
              </DialogHeader>
              <NewItemForm
                suppliers={suppliers}
                onSubmit={(data) => createItemMutation.mutate(data)}
                isLoading={createItemMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Adjust Balance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adjust Stock Balance</DialogTitle>
              </DialogHeader>
              <AdjustForm
                items={items}
                locations={locations}
                onSubmit={(data) => adjustMutation.mutate(data)}
                isLoading={adjustMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showMove} onOpenChange={setShowMove}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Move Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Move Stock</DialogTitle>
              </DialogHeader>
              <MoveForm
                items={items}
                locations={locations}
                onSubmit={(data) => moveMutation.mutate(data)}
                isLoading={moveMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showConsume} onOpenChange={setShowConsume}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Consume for Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Consume Stock for Project</DialogTitle>
              </DialogHeader>
              <ConsumeForm
                items={items}
                locations={locations}
                projects={projects}
                onSubmit={(data) => consumeMutation.mutate(data)}
                isLoading={consumeMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Items List */}
      {loadingItems ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No stock items yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const itemBalances = balances.filter(b => b.inventory_item_v2_id === item.id);
            const totalQty = itemBalances.reduce((sum, b) => sum + (b.qty_on_hand || 0), 0);

            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg">{item.name}</div>
                      {item.sku && <div className="text-sm text-gray-600">SKU: {item.sku}</div>}
                      {item.category && <div className="text-xs text-gray-500">{item.category}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{totalQty}</div>
                      <div className="text-xs text-gray-500">{item.unit || 'units'}</div>
                    </div>
                  </div>
                  {itemBalances.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-medium text-gray-600 mb-2">By Location:</div>
                      <div className="grid grid-cols-3 gap-2">
                        {itemBalances.map(b => (
                          <div key={b.id} className="text-sm">
                            <span className="text-gray-600">{locationMap[b.location_v2_id] || 'Unknown'}:</span>{' '}
                            <span className="font-medium">{b.qty_on_hand || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewItemForm({ suppliers, onSubmit, isLoading }) {
  const [data, setData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    reorder_point: '',
    default_supplier_id: '',
    unit_cost_ex_tax: ''
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>SKU</Label>
          <Input value={data.sku} onChange={(e) => setData({ ...data, sku: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unit</Label>
          <Input value={data.unit} onChange={(e) => setData({ ...data, unit: e.target.value })} placeholder="e.g. each, box" />
        </div>
        <div>
          <Label>Reorder Point</Label>
          <Input type="number" value={data.reorder_point} onChange={(e) => setData({ ...data, reorder_point: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Default Supplier</Label>
        <Select value={data.default_supplier_id} onValueChange={(value) => setData({ ...data, default_supplier_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>None</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Unit Cost (ex tax)</Label>
        <Input type="number" step="0.01" value={data.unit_cost_ex_tax} onChange={(e) => setData({ ...data, unit_cost_ex_tax: e.target.value })} />
      </div>
      <Button onClick={() => onSubmit(data)} disabled={!data.name || isLoading} className="w-full">
        Create Item
      </Button>
    </div>
  );
}

function AdjustForm({ items, locations, onSubmit, isLoading }) {
  const [data, setData] = useState({
    stock_item_id: '',
    inventory_location_id: '',
    qty_delta: '',
    note: ''
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Item *</Label>
        <Select value={data.stock_item_id} onValueChange={(value) => setData({ ...data, stock_item_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {items.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Location *</Label>
        <Select value={data.inventory_location_id} onValueChange={(value) => setData({ ...data, inventory_location_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Quantity Change * (positive=add, negative=remove)</Label>
        <Input type="number" value={data.qty_delta} onChange={(e) => setData({ ...data, qty_delta: e.target.value })} />
      </div>
      <div>
        <Label>Note</Label>
        <Input value={data.note} onChange={(e) => setData({ ...data, note: e.target.value })} />
      </div>
      <Button
        onClick={() => onSubmit({ ...data, qty_delta: parseFloat(data.qty_delta) })}
        disabled={!data.stock_item_id || !data.inventory_location_id || !data.qty_delta || isLoading}
        className="w-full"
      >
        Adjust
      </Button>
    </div>
  );
}

function MoveForm({ items, locations, onSubmit, isLoading }) {
  const [data, setData] = useState({
    stock_item_id: '',
    from_location_id: '',
    to_location_id: '',
    qty: '',
    note: ''
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Item *</Label>
        <Select value={data.stock_item_id} onValueChange={(value) => setData({ ...data, stock_item_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {items.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>From Location *</Label>
        <Select value={data.from_location_id} onValueChange={(value) => setData({ ...data, from_location_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>To Location *</Label>
        <Select value={data.to_location_id} onValueChange={(value) => setData({ ...data, to_location_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Quantity *</Label>
        <Input type="number" value={data.qty} onChange={(e) => setData({ ...data, qty: e.target.value })} />
      </div>
      <div>
        <Label>Note</Label>
        <Input value={data.note} onChange={(e) => setData({ ...data, note: e.target.value })} />
      </div>
      <Button
        onClick={() => onSubmit({ ...data, qty: parseFloat(data.qty) })}
        disabled={!data.stock_item_id || !data.from_location_id || !data.to_location_id || !data.qty || isLoading}
        className="w-full"
      >
        Move Stock
      </Button>
    </div>
  );
}

function ConsumeForm({ items, locations, projects, onSubmit, isLoading }) {
  const [data, setData] = useState({
    project_id: '',
    stock_item_id: '',
    from_location_id: '',
    qty: '',
    note: ''
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Project *</Label>
        <Select value={data.project_id} onValueChange={(value) => setData({ ...data, project_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.project_number} - {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Item *</Label>
        <Select value={data.stock_item_id} onValueChange={(value) => setData({ ...data, stock_item_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {items.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>From Location *</Label>
        <Select value={data.from_location_id} onValueChange={(value) => setData({ ...data, from_location_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Quantity *</Label>
        <Input type="number" value={data.qty} onChange={(e) => setData({ ...data, qty: e.target.value })} />
      </div>
      <div>
        <Label>Note</Label>
        <Input value={data.note} onChange={(e) => setData({ ...data, note: e.target.value })} />
      </div>
      <Button
        onClick={() => onSubmit({ ...data, qty: parseFloat(data.qty) })}
        disabled={!data.project_id || !data.stock_item_id || !data.from_location_id || !data.qty || isLoading}
        className="w-full"
      >
        Consume
      </Button>
    </div>
  );
}