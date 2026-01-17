/**
 * BASELINE STOCK SEED - Admin Only
 * One-time migration tool to initialize Day-0 inventory from physical stocktake
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getPhysicalAvailableLocations } from '@/components/utils/inventoryLocationUtils';

export default function BaselineStockSeed() {
  const [user, setUser] = React.useState(null);
  const [seedRows, setSeedRows] = useState([]);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [mode, setMode] = useState('exact'); // 'exact' | 'delta'
  const [skuSearch, setSkuSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState(null);
  const queryClient = useQueryClient();

  // Load user
  React.useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    load();
  }, []);

  // Check admin access
  if (user && user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Access Denied</h3>
                <p className="text-sm text-red-700 mt-1">
                  Only administrators can access the Baseline Stock Seed tool.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch locations
  const { data: allLocations = [] } = useQuery({
    queryKey: ['locations-for-baseline'],
    queryFn: () => base44.entities.InventoryLocation.filter({}),
    staleTime: 60000,
  });

  const locations = useMemo(() => getPhysicalAvailableLocations(allLocations), [allLocations]);

  // Identify warehouse and vehicles
  const warehouseLocation = useMemo(() => {
    return locations.find(l => String(l.type || '').toLowerCase() === 'warehouse') || null;
  }, [locations]);

  const vehicleLocations = useMemo(() => {
    return locations.filter(l => String(l.type || '').toLowerCase() === 'vehicle');
  }, [locations]);

  // Fetch SKUs
  const { data: skus = [] } = useQuery({
    queryKey: ['price-list-items-for-baseline'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
    staleTime: 60000,
  });

  // Fetch current InventoryQuantity (new ledger only)
  const { data: currentQuantities = [] } = useQuery({
    queryKey: ['inventory-quantities-for-baseline'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
    staleTime: 30000,
  });

  // Filter SKUs by search
  const filteredSkus = useMemo(() => {
    if (!skuSearch) return skus.slice(0, 20);
    return skus.filter(s =>
      s.item?.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.sku?.toLowerCase().includes(skuSearch.toLowerCase())
    ).slice(0, 20);
  }, [skus, skuSearch]);

  // Check if baseline already executed
  const { data: existingRuns = [] } = useQuery({
    queryKey: ['baseline-seed-runs'],
    queryFn: () => base44.asServiceRole.entities.BaselineSeedRun.list(),
    staleTime: 30000,
  });

  const hasExecuted = existingRuns.length > 0;
  const lastRun = existingRuns[existingRuns.length - 1];

  // Add SKU row with prefilled current values from InventoryQuantity
  const addSkuRow = (sku) => {
    const newRow = {
      price_list_item_id: sku.id,
      item_name: sku.item,
      quantities: {}
    };

    // Prefill all locations with current InventoryQuantity values
    if (warehouseLocation) {
      const current = currentQuantities.find(
        q => q.price_list_item_id === sku.id && q.location_id === warehouseLocation.id
      );
      newRow.quantities[warehouseLocation.id] = {
        current: current?.quantity || 0,
        counted: current?.quantity || 0
      };
    }

    vehicleLocations.forEach(v => {
      const current = currentQuantities.find(
        q => q.price_list_item_id === sku.id && q.location_id === v.id
      );
      newRow.quantities[v.id] = {
        current: current?.quantity || 0,
        counted: current?.quantity || 0
      };
    });

    setSeedRows([...seedRows, newRow]);
    setSelectedSku(null);
    setSkuSearch('');
  };

  // Update counted value
  const updateCounted = (rowIdx, locationId, value) => {
    const newRows = [...seedRows];
    const qty = newRows[rowIdx].quantities[locationId];
    if (qty) {
      qty.counted = Math.max(0, parseInt(value) || 0);
    }
    setSeedRows(newRows);
  };

  // Remove row
  const removeRow = (rowIdx) => {
    setSeedRows(seedRows.filter((_, i) => i !== rowIdx));
  };

  // Execute seed
  const seedMutation = useMutation({
    mutationFn: async () => {
      const seedData = seedRows.map(row => ({
        price_list_item_id: row.price_list_item_id,
        item_name: row.item_name,
        locations: Object.entries(row.quantities)
          .map(([locId, qty]) => {
            const loc = locations.find(l => l.id === locId);
            return {
              location_id: locId,
              location_name: loc?.name || 'Unknown',
              current: qty.current,
              counted: qty.counted
            };
          })
      }));

      const response = await base44.functions.invoke('seedBaselineStock', {
        seedData,
        allowRerun: hasExecuted && allowOverride,
        overrideReason: hasExecuted && allowOverride ? overrideReason : undefined
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['baseline-seed-runs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      queryClient.invalidateQueries({ queryKey: ['vehicleStock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });

      toast.success('Baseline stock seeded successfully');
      setSeedRows([]);
      setConfirmChecked(false);
      setAllowOverride(false);
      setOverrideReason('');
    },
    onError: (error) => {
      toast.error(error.message || 'Seeding failed');
    },
  });

  // Check if any values changed
  const hasChanges = seedRows.some(row =>
    Object.values(row.quantities).some(q => q.current !== q.counted)
  );

  const isFormValid = (hasExecuted ? (allowOverride && overrideReason.trim().length > 0 && confirmChecked) : (hasChanges && confirmChecked));

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Baseline Stock Seed (Day 0)</h1>
        <p className="text-gray-600 mt-2">Initialize inventory from a physical stocktake. Run once only.</p>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50 mb-6">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>One-time only operation.</strong> After execution, this tool will be locked to prevent accidental re-runs. Use only after completing a full physical stocktake of all locations.
          </div>
        </CardContent>
      </Card>

      {/* Already Executed Message */}
      {hasExecuted && (
        <Card className={`mb-6 ${allowOverride ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <CardContent className="p-4 flex gap-3">
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${allowOverride ? 'text-amber-600' : 'text-green-600'}`} />
            <div className={`text-sm ${allowOverride ? 'text-amber-800' : 'text-green-800'}`}>
              <strong>Baseline seed already executed</strong>
              <div className="mt-1">
                Date: {new Date(lastRun.executed_at).toLocaleString()}
              </div>
              <div>By: {lastRun.executed_by_name}</div>
              <div className="mt-3">
                {!allowOverride && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllowOverride(true)}
                  >
                    Allow Re-run
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = new URL(window.location);
                    url.pathname = '/StockMovements';
                    url.searchParams.set('reference_type', 'system_migration');
                    url.searchParams.set('reference_id', lastRun.seed_batch_id);
                    window.location.href = url.toString();
                  }}
                  className="ml-2"
                >
                  View Previous Movements
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Locations Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warehouseLocation && (
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <div className="font-semibold text-sm text-blue-900">
                  📦 {warehouseLocation.name}
                </div>
                <div className="text-xs text-blue-700 mt-1">Primary Warehouse</div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Vehicles ({vehicleLocations.length})
              </div>
              <div className="space-y-1">
                {vehicleLocations.map(v => (
                  <div key={v.id} className="text-sm text-gray-700 px-2 py-1 bg-gray-50 rounded border border-gray-200">
                    🚗 {v.name}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SKU Entry + Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="exact"
                  checked={mode === 'exact'}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">
                  <strong>Set Exact Counts (Baseline)</strong>
                  <div className="text-xs text-gray-500">Replace current values with stocktake counts</div>
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer opacity-50">
                <input
                  type="radio"
                  value="delta"
                  checked={mode === 'delta'}
                  onChange={(e) => setMode(e.target.value)}
                  disabled
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">
                  <strong>Adjust by Delta</strong>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </span>
              </label>
            </CardContent>
          </Card>

          {/* SKU Search & Add */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add SKUs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sku-search">Search SKU</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="sku-search"
                    placeholder="Item name or SKU..."
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {skuSearch && filteredSkus.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredSkus.map(sku => (
                    <button
                      key={sku.id}
                      onClick={() => addSkuRow(sku)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 transition-colors"
                    >
                      <div className="font-medium text-sm text-gray-900">{sku.item}</div>
                      {sku.sku && <div className="text-xs text-gray-500">SKU: {sku.sku}</div>}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stocktake Data</CardTitle>
              <p className="text-xs text-gray-500 mt-2">Current values prefilled from inventory ledger</p>
            </CardHeader>
            <CardContent>
              {seedRows.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No SKUs added yet. Search and select above.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {seedRows.map((row, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm text-gray-900">{row.item_name}</div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(idx)}
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3">
                        {warehouseLocation && (
                          <div className="grid grid-cols-12 gap-2 items-center text-xs">
                            <div className="col-span-3 font-medium text-gray-700">{warehouseLocation.name}</div>
                            <div className="col-span-2 text-gray-600">
                              Current: <span className="font-semibold">{row.quantities[warehouseLocation.id]?.current || 0}</span>
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                min="0"
                                value={row.quantities[warehouseLocation.id]?.counted || 0}
                                onChange={(e) => updateCounted(idx, warehouseLocation.id, e.target.value)}
                                placeholder="Counted"
                                className="h-7 text-sm"
                              />
                            </div>
                            <div className="col-span-4 text-gray-500">
                              Δ: <span className={row.quantities[warehouseLocation.id]?.counted !== row.quantities[warehouseLocation.id]?.current ? 'font-semibold text-orange-600' : ''}>
                                {(row.quantities[warehouseLocation.id]?.counted || 0) - (row.quantities[warehouseLocation.id]?.current || 0)}
                              </span>
                            </div>
                          </div>
                        )}

                        {vehicleLocations.map(v => (
                          <div key={v.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                            <div className="col-span-3 font-medium text-gray-700">{v.name}</div>
                            <div className="col-span-2 text-gray-600">
                              Current: <span className="font-semibold">{row.quantities[v.id]?.current || 0}</span>
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                min="0"
                                value={row.quantities[v.id]?.counted || 0}
                                onChange={(e) => updateCounted(idx, v.id, e.target.value)}
                                placeholder="Counted"
                                className="h-7 text-sm"
                              />
                            </div>
                            <div className="col-span-4 text-gray-500">
                              Δ: <span className={row.quantities[v.id]?.counted !== row.quantities[v.id]?.current ? 'font-semibold text-orange-600' : ''}>
                                {(row.quantities[v.id]?.counted || 0) - (row.quantities[v.id]?.current || 0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation & Submit */}
      <Card className="mt-6">
        <CardContent className="p-6 space-y-4">
          {hasExecuted && allowOverride && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                <strong>Re-run Mode:</strong> This will overwrite existing InventoryQuantity records.
              </div>
              <div className="space-y-2">
                <Label htmlFor="override-reason">Reason for Re-run *</Label>
                <Input
                  id="override-reason"
                  placeholder="e.g., Correcting stocktake error, updated counts..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="confirm-check"
              checked={confirmChecked}
              onCheckedChange={setConfirmChecked}
              disabled={hasExecuted && !allowOverride ? true : (seedRows.length === 0)}
            />
            <label htmlFor="confirm-check" className="text-sm text-gray-700 cursor-pointer">
              {hasExecuted && allowOverride
                ? 'I understand this will overwrite InventoryQuantity counts.'
                : 'I confirm this matches the physical stocktake for all locations.'}
            </label>
          </div>

          <Button
            onClick={() => seedMutation.mutate()}
            disabled={!isFormValid || seedMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {seedMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              `Execute Baseline Seed (${seedRows.length} SKUs${hasChanges && !hasExecuted ? ', ' + seedRows.reduce((sum, row) => sum + Object.values(row.quantities).filter(q => q.current !== q.counted).length, 0) + ' changes' : ''})`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}