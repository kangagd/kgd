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
  const [filterEmpty, setFilterEmpty] = useState(false);
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

  // Auto-populate seedRows from existing InventoryQuantities on load
  React.useEffect(() => {
    if (currentQuantities.length > 0 && seedRows.length === 0) {
      const bySkuMap = {};

      currentQuantities.forEach(qty => {
        if (!bySkuMap[qty.price_list_item_id]) {
          bySkuMap[qty.price_list_item_id] = {
            price_list_item_id: qty.price_list_item_id,
            item_name: qty.item_name || 'Unknown',
            quantities: {}
          };
        }
        bySkuMap[qty.price_list_item_id].quantities[qty.location_id] = {
          current: qty.quantity || 0,
          counted: qty.quantity || 0
        };
      });

      // Initialize empty locations for each SKU
      Object.values(bySkuMap).forEach(row => {
        if (warehouseLocation && !row.quantities[warehouseLocation.id]) {
          row.quantities[warehouseLocation.id] = { current: 0, counted: 0 };
        }
        vehicleLocations.forEach(v => {
          if (!row.quantities[v.id]) {
            row.quantities[v.id] = { current: 0, counted: 0 };
          }
        });
      });

      setSeedRows(Object.values(bySkuMap));
    }
  }, [currentQuantities, warehouseLocation, vehicleLocations, seedRows.length]);

  // Filter displayed rows
  const displayedRows = useMemo(() => {
    if (filterEmpty) {
      return seedRows.filter(row =>
        Object.values(row.quantities).some(q => q.counted > 0)
      );
    }
    return seedRows;
  }, [seedRows, filterEmpty]);

  // Check if baseline already executed
  const { data: existingRuns = [] } = useQuery({
    queryKey: ['baseline-seed-runs'],
    queryFn: () => base44.asServiceRole.entities.BaselineSeedRun.list(),
    staleTime: 30000,
  });

  const hasExecuted = existingRuns.length > 0;
  const lastRun = existingRuns[existingRuns.length - 1];

  // Add empty SKU row for new SKUs
  const addNewSkuRow = (sku) => {
    // Check if already added
    if (seedRows.find(r => r.price_list_item_id === sku.id)) {
      toast.error('SKU already added');
      return;
    }

    const newRow = {
      price_list_item_id: sku.id,
      item_name: sku.item,
      quantities: {}
    };

    // Initialize all locations with 0
    if (warehouseLocation) {
      newRow.quantities[warehouseLocation.id] = { current: 0, counted: 0 };
    }
    vehicleLocations.forEach(v => {
      newRow.quantities[v.id] = { current: 0, counted: 0 };
    });

    setSeedRows([...seedRows, newRow]);
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

      <div className="space-y-4">
        {/* Summary Card */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold text-gray-900">{displayedRows.length}</span>
              <span className="text-gray-600 ml-1">SKUs loaded</span>
            </div>
            {seedRows.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  id="filter-empty"
                  checked={filterEmpty}
                  onCheckedChange={setFilterEmpty}
                />
                <span className="text-gray-700">Hide empty rows</span>
              </label>
            )}
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        {/* Stocktake Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stocktake Data</CardTitle>
            <p className="text-xs text-gray-500 mt-2">Edit counts as needed. Current values prefilled from inventory ledger.</p>
          </CardHeader>
          <CardContent>
            {seedRows.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Loading existing inventory...</p>
            ) : displayedRows.length === 0 ? (
              <p className="text-sm text-gray-500 italic">All rows are empty. Uncheck "Hide empty rows" to see all.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th className="text-left font-semibold text-gray-700 p-2">SKU / Item</th>
                      {warehouseLocation && (
                        <th className="text-center font-semibold text-gray-700 p-2">
                          <div>{warehouseLocation.name}</div>
                          <div className="text-gray-500 font-normal">Current → Counted</div>
                        </th>
                      )}
                      {vehicleLocations.map(v => (
                        <th key={v.id} className="text-center font-semibold text-gray-700 p-2">
                          <div>{v.name}</div>
                          <div className="text-gray-500 font-normal">Current → Counted</div>
                        </th>
                      ))}
                      <th className="text-center font-semibold text-gray-700 p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row, idx) => {
                      const actualIdx = seedRows.findIndex(r => r.price_list_item_id === row.price_list_item_id);
                      return (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                          <td className="p-2 text-gray-900 font-medium">{row.item_name}</td>
                          {warehouseLocation && (
                            <td className="p-2">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-gray-600">{row.quantities[warehouseLocation.id]?.current || 0}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.quantities[warehouseLocation.id]?.counted || 0}
                                  onChange={(e) => updateCounted(actualIdx, warehouseLocation.id, e.target.value)}
                                  className="w-12 h-7 text-center text-sm"
                                />
                                {row.quantities[warehouseLocation.id]?.current !== row.quantities[warehouseLocation.id]?.counted && (
                                  <span className="text-orange-600 font-semibold">
                                    {(row.quantities[warehouseLocation.id]?.counted || 0) - (row.quantities[warehouseLocation.id]?.current || 0)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {vehicleLocations.map(v => (
                            <td key={v.id} className="p-2">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-gray-600">{row.quantities[v.id]?.current || 0}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.quantities[v.id]?.counted || 0}
                                  onChange={(e) => updateCounted(actualIdx, v.id, e.target.value)}
                                  className="w-12 h-7 text-center text-sm"
                                />
                                {row.quantities[v.id]?.current !== row.quantities[v.id]?.counted && (
                                  <span className="text-orange-600 font-semibold">
                                    {(row.quantities[v.id]?.counted || 0) - (row.quantities[v.id]?.current || 0)}
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                          <td className="p-2 text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeRow(actualIdx)}
                              className="h-6 w-6 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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