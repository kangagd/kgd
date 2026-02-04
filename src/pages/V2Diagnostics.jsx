import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, CheckCircle, Sprout, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatInventoryLocationLabel, getTargetLocationsForDropdown } from '@/components/utils/inventoryLocationUtils';

export default function V2Diagnostics() {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  
  // Seed inventory state
  const [seedCatalogItemId, setSeedCatalogItemId] = useState('');
  const [seedQuantity, setSeedQuantity] = useState('');
  const [seedLocationId, setSeedLocationId] = useState('');
  const [seedNote, setSeedNote] = useState('');
  const [seedForce, setSeedForce] = useState(false);
  const [seededItems, setSeededItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [locations, setLocations] = useState([]);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setAllowed(currentUser?.role === 'admin');
      } catch (error) {
        console.error('Error loading user:', error);
        setAllowed(false);
      }
    };
    loadUser();
  }, []);

  // Load seeded items and reference data
  React.useEffect(() => {
    const loadData = async () => {
      if (!allowed) return;
      try {
        const [seeds, items, locs] = await Promise.all([
          base44.entities.StockMovement.filter(
            { source_type: 'initial_seed' },
            '-created_date',
            50
          ),
          base44.entities.PriceListItem.filter({ track_inventory: true }, 'item'),
          base44.entities.InventoryLocation.filter({ is_active: true }, 'location_code')
        ]);
        setSeededItems(seeds);
        setCatalogItems(items);
        setLocations(getTargetLocationsForDropdown(locs));
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [allowed]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Access Denied</CardTitle>
            <CardDescription className="text-red-800">
              Admin access required for V2 Diagnostics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const runDiagnostic = async (fnName, params) => {
    setLoading(prev => ({ ...prev, [fnName]: true }));
    try {
      const result = await base44.functions.invoke(fnName, params);
      
      if (result.data?.success) {
        setResults(prev => ({ ...prev, [fnName]: result.data }));
        toast.success(`${fnName}: ${result.data.summary || 'Success'}`);
      } else {
        toast.error(`${fnName} failed: ${result.data?.error || 'unknown error'}`);
        setResults(prev => ({ ...prev, [fnName]: { error: result.data?.error } }));
      }
    } catch (error) {
      console.error(`${fnName} error:`, error);
      toast.error(`${fnName} error: ${error.message}`);
      setResults(prev => ({ ...prev, [fnName]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [fnName]: false }));
    }
  };

  const runLocationIntegrityCheck = async () => {
    const fnName = 'checkInventoryLocationIntegrity';
    setLoading(prev => ({ ...prev, [fnName]: true }));
    try {
      const result = await base44.functions.invoke(fnName, {});
      
      if (result.data) {
        setResults(prev => ({ ...prev, [fnName]: result.data }));
        if (result.data.status === 'PASS') {
          toast.success('Location integrity check passed');
        } else {
          toast.warning('Location integrity check found issues');
        }
      }
    } catch (error) {
      console.error(`${fnName} error:`, error);
      toast.error(`${fnName} error: ${error.message}`);
      setResults(prev => ({ ...prev, [fnName]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [fnName]: false }));
    }
  };

  const runSeedInventory = async () => {
    const fnName = 'seedInventoryItem';
    setLoading(prev => ({ ...prev, [fnName]: true }));
    try {
      const result = await base44.functions.invoke(fnName, {
        catalog_item_id: seedCatalogItemId,
        quantity: parseFloat(seedQuantity),
        to_location_id: seedLocationId,
        note: seedNote || undefined,
        force: seedForce
      });

      if (result.data?.success) {
        toast.success(result.data.summary);
        // Reload seeded items
        const seeds = await base44.entities.StockMovement.filter(
          { source_type: 'initial_seed' },
          '-created_date',
          50
        );
        setSeededItems(seeds);
        // Reset form
        setSeedCatalogItemId('');
        setSeedQuantity('');
        setSeedLocationId('');
        setSeedNote('');
        setSeedForce(false);
      } else if (result.data?.requires_confirmation) {
        toast.warning(result.data.warning);
        setSeedForce(true); // Enable force mode for next submit
      } else {
        toast.error(result.data?.error || 'Seeding failed');
      }
    } catch (error) {
      console.error(`${fnName} error:`, error);
      toast.error(`${fnName} error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [fnName]: false }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Parts/Logistics V2 Diagnostics</h1>
        <p className="text-gray-600">Admin tools for fixing data issues and recomputing cached fields.</p>
      </div>

      {/* Project Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="project-id">Project ID (for project-scoped operations)</Label>
              <Input
                id="project-id"
                placeholder="Paste project ID here"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <div className="grid gap-6">
        {/* Readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Recompute Readiness
              <Badge variant="outline">Project-scoped</Badge>
            </CardTitle>
            <CardDescription>Recalculate visit readiness based on allocations and consumptions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('computeVisitReadiness', { project_id: projectId })}
              disabled={loading['computeVisitReadiness'] || !projectId}
              className="w-full"
            >
              {loading['computeVisitReadiness'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Recompute Readiness'
              )}
            </Button>
            {results['computeVisitReadiness'] && (
              <ResultsDisplay result={results['computeVisitReadiness']} />
            )}
          </CardContent>
        </Card>

        {/* Requirement Fulfillment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Recompute Requirement Fulfillment
              <Badge variant="outline">Project-scoped</Badge>
            </CardTitle>
            <CardDescription>Recalculate whether all blocking requirements are met.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('computeProjectRequirementFulfillment', { project_id: projectId })}
              disabled={loading['computeProjectRequirementFulfillment'] || !projectId}
              className="w-full"
            >
              {loading['computeProjectRequirementFulfillment'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Recompute Requirements'
              )}
            </Button>
            {results['computeProjectRequirementFulfillment'] && (
              <ResultsDisplay result={results['computeProjectRequirementFulfillment']} />
            )}
          </CardContent>
        </Card>

        {/* Normalize SLA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Normalize Receipt SLA
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Ensure all receipts have sla_clock_start_at and sla_due_at fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('normalizeReceiptSlaFromReceivedAt', {})}
              disabled={loading['normalizeReceiptSlaFromReceivedAt']}
              className="w-full"
            >
              {loading['normalizeReceiptSlaFromReceivedAt'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Normalize SLA'
              )}
            </Button>
            {results['normalizeReceiptSlaFromReceivedAt'] && (
              <ResultsDisplay result={results['normalizeReceiptSlaFromReceivedAt']} />
            )}
          </CardContent>
        </Card>

        {/* Backfill Cached Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Backfill Cached Display Fields
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Populate names/numbers for Projects, Jobs, Vehicles, Locations in related records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('backfillCachedDisplayFields', {})}
              disabled={loading['backfillCachedDisplayFields']}
              className="w-full"
            >
              {loading['backfillCachedDisplayFields'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Backfill Fields'
              )}
            </Button>
            {results['backfillCachedDisplayFields'] && (
              <ResultsDisplay result={results['backfillCachedDisplayFields']} />
            )}
          </CardContent>
        </Card>

        {/* Location Integrity Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Location Integrity Check
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Verify inventory location setup: required locations, duplicates, orphaned records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runLocationIntegrityCheck()}
              disabled={loading['checkInventoryLocationIntegrity']}
              className="w-full"
            >
              {loading['checkInventoryLocationIntegrity'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Run Location Integrity Check'
              )}
            </Button>
            {results['checkInventoryLocationIntegrity'] && (
              <LocationIntegrityResults result={results['checkInventoryLocationIntegrity']} />
            )}
          </CardContent>
        </Card>

        {/* Report Vehicle Duplicates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Report Vehicle Location Duplicates
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Check for vehicles with multiple active InventoryLocation records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('reportVehicleLocationDuplicates', {})}
              disabled={loading['reportVehicleLocationDuplicates']}
              className="w-full"
            >
              {loading['reportVehicleLocationDuplicates'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                'Report Duplicates'
              )}
            </Button>
            {results['reportVehicleLocationDuplicates'] && (
              <ResultsDisplay result={results['reportVehicleLocationDuplicates']} />
            )}
          </CardContent>
        </Card>

        {/* Deduplicate Vehicle Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Deduplicate Vehicle Locations
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Ensure each vehicle has exactly one active InventoryLocation. Deactivates duplicates safely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => runDiagnostic('deduplicateVehicleInventoryLocations', {})}
              disabled={loading['deduplicateVehicleInventoryLocations']}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {loading['deduplicateVehicleInventoryLocations'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Deduplicate Vehicles'
              )}
            </Button>
            {results['deduplicateVehicleInventoryLocations'] && (
              <ResultsDisplay result={results['deduplicateVehicleInventoryLocations']} />
            )}
          </CardContent>
        </Card>

        {/* Seed Inventory */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sprout className="w-5 h-5" />
              Seed Inventory
              <Badge variant="outline">Global</Badge>
            </CardTitle>
            <CardDescription>Add initial stock via StockMovement. Idempotent and traceable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="seed-item">Catalog Item</Label>
                <Select value={seedCatalogItemId} onValueChange={setSeedCatalogItemId}>
                  <SelectTrigger id="seed-item">
                    <SelectValue placeholder="Select catalog item" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item} {item.sku ? `(${item.sku})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="seed-qty">Quantity</Label>
                <Input
                  id="seed-qty"
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={seedQuantity}
                  onChange={(e) => setSeedQuantity(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="seed-location">Target Location (Warehouse or Vehicle only)</Label>
                <Select value={seedLocationId} onValueChange={setSeedLocationId}>
                  <SelectTrigger id="seed-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {formatInventoryLocationLabel(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="seed-note">Note (optional)</Label>
                <Input
                  id="seed-note"
                  placeholder="Optional note"
                  value={seedNote}
                  onChange={(e) => setSeedNote(e.target.value)}
                />
              </div>

              {seedForce && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800">Confirmation mode enabled</span>
                </div>
              )}
            </div>

            <Button
              onClick={() => runSeedInventory()}
              disabled={loading['seedInventoryItem'] || !seedCatalogItemId || !seedQuantity || !seedLocationId}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loading['seedInventoryItem'] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Sprout className="w-4 h-4 mr-2" />
                  Seed Inventory
                </>
              )}
            </Button>

            {/* Seeded Items Table */}
            {seededItems.length > 0 && (
              <div className="mt-6 border rounded-lg overflow-hidden">
                <div className="bg-slate-50 border-b px-3 py-2">
                  <p className="text-sm font-semibold">Recent Seeds ({seededItems.length})</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-left p-2 font-medium">Location</th>
                        <th className="text-right p-2 font-medium">Qty</th>
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seededItems.map(seed => (
                        <tr key={seed.id} className="border-b hover:bg-slate-50">
                          <td className="p-2">{seed.catalog_item_name}</td>
                          <td className="p-2">{seed.to_location_code}</td>
                          <td className="p-2 text-right font-mono">{seed.qty}</td>
                          <td className="p-2 text-slate-600">
                            {new Date(seed.created_date).toLocaleDateString()}
                          </td>
                          <td className="p-2 text-slate-600">{seed.created_by_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LocationIntegrityResults({ result }) {
  if (result.error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  const isPassing = result.status === 'PASS';

  return (
    <div className={`p-3 border rounded-lg space-y-3 ${isPassing ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex gap-2 items-start">
        {isPassing ? (
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="text-sm">
          <p className={`font-semibold ${isPassing ? 'text-green-800' : 'text-red-800'}`}>
            Status: {result.status}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      {result.summary && (
        <div className="text-xs bg-white border rounded p-2 space-y-1">
          <p className="font-semibold mb-1">Summary:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Total Locations:</span><span className="font-mono">{result.summary.total_locations}</span>
            <span>Active Locations:</span><span className="font-mono">{result.summary.active_locations}</span>
            <span>LOADING_BAY:</span><span className="font-mono">{result.summary.loading_bay_count}</span>
            <span>CONSUMED:</span><span className="font-mono">{result.summary.consumed_count}</span>
            <span>Warehouses:</span><span className="font-mono">{result.summary.warehouse_count}</span>
            <span>Vehicle Locations:</span><span className="font-mono">{result.summary.vehicle_location_count}</span>
            <span>Total Vehicles:</span><span className="font-mono">{result.summary.total_vehicles}</span>
          </div>
        </div>
      )}

      {/* Missing Locations */}
      {result.missing_locations && result.missing_locations.length > 0 && (
        <div className="text-xs bg-red-100 border border-red-300 rounded p-2">
          <p className="font-semibold text-red-800 mb-1">Missing Locations ({result.missing_locations.length}):</p>
          <ul className="space-y-1 list-disc list-inside">
            {result.missing_locations.map((item, idx) => (
              <li key={idx} className="text-red-700">
                {item.location_code || item.location_type || item.vehicle_name} - {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Duplicate Locations */}
      {result.duplicate_locations && result.duplicate_locations.length > 0 && (
        <div className="text-xs bg-red-100 border border-red-300 rounded p-2">
          <p className="font-semibold text-red-800 mb-1">Duplicate Locations ({result.duplicate_locations.length}):</p>
          <ul className="space-y-1 list-disc list-inside">
            {result.duplicate_locations.map((item, idx) => (
              <li key={idx} className="text-red-700">
                {item.location_code || item.vehicle_name} - {item.count} duplicates
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Orphaned Vehicle Locations */}
      {result.orphaned_vehicle_locations && result.orphaned_vehicle_locations.length > 0 && (
        <div className="text-xs bg-red-100 border border-red-300 rounded p-2">
          <p className="font-semibold text-red-800 mb-1">Orphaned Vehicle Locations ({result.orphaned_vehicle_locations.length}):</p>
          <ul className="space-y-1 list-disc list-inside">
            {result.orphaned_vehicle_locations.map((item, idx) => (
              <li key={idx} className="text-red-700">
                {item.location_code} (vehicle_id: {item.vehicle_id}) - {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inactive Locations in Use */}
      {result.inactive_locations_in_use && result.inactive_locations_in_use.length > 0 && (
        <div className="text-xs bg-red-100 border border-red-300 rounded p-2">
          <p className="font-semibold text-red-800 mb-1">Inactive Locations in Use ({result.inactive_locations_in_use.length}):</p>
          <ul className="space-y-1 list-disc list-inside">
            {result.inactive_locations_in_use.map((item, idx) => (
              <li key={idx} className="text-red-700">
                {item.location_code} ({item.location_type})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResultsDisplay({ result }) {
  if (result.error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
      <div className="flex gap-2 items-start">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-800">
          <p className="font-semibold">Success</p>
          {result.summary && <p>{result.summary}</p>}
        </div>
      </div>
      
      {/* Display structured results */}
      {Object.entries(result).map(([key, value]) => {
        if (key === 'success' || key === 'summary' || key === 'error') return null;
        if (typeof value === 'object') {
          return (
            <div key={key} className="text-xs text-green-700 mt-2 pl-7">
              <p className="font-mono bg-green-100 rounded px-2 py-1">
                {key}: {JSON.stringify(value)}
              </p>
            </div>
          );
        }
        return (
          <div key={key} className="text-xs text-green-700 mt-1 pl-7">
            {key}: {String(value)}
          </div>
        );
      })}
    </div>
  );
}