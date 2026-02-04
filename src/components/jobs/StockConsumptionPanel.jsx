import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StockConsumptionPanel({ job }) {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState({});
  const [showOverConsumptionDialog, setShowOverConsumptionDialog] = useState(null);

  // Fetch allocations for this job
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['stockAllocations', job.id],
    queryFn: async () => {
      return await base44.entities.StockAllocation.filter({
        job_id: job.id,
        status: { $in: ['reserved', 'loaded'] }
      });
    }
  });

  // Fetch consumptions to calculate remaining
  const { data: consumptions = [] } = useQuery({
    queryKey: ['stockConsumptions', job.id],
    queryFn: async () => {
      return await base44.entities.StockConsumption.filter({
        job_id: job.id
      });
    }
  });

  // Group allocations by catalog_item_id
  const groupedAllocations = React.useMemo(() => {
    const groups = new Map();
    
    allocations.forEach(alloc => {
      const key = alloc.catalog_item_id || 'adhoc';
      if (!groups.has(key)) {
        groups.set(key, {
          catalog_item_id: alloc.catalog_item_id,
          catalog_item_name: alloc.catalog_item_name,
          allocations: [],
          total_allocated: 0,
          total_consumed: 0
        });
      }
      
      const group = groups.get(key);
      group.allocations.push(alloc);
      group.total_allocated += alloc.qty_allocated || 0;
    });

    // Calculate consumed amounts
    consumptions.forEach(cons => {
      const key = cons.catalog_item_id || 'adhoc';
      if (groups.has(key)) {
        groups.get(key).total_consumed += cons.qty_consumed || 0;
      }
    });

    return Array.from(groups.values()).map(group => ({
      ...group,
      remaining: group.total_allocated - group.total_consumed
    }));
  }, [allocations, consumptions]);

  // Initialize selected items with remaining quantities
  React.useEffect(() => {
    const initial = {};
    groupedAllocations.forEach(group => {
      const key = group.catalog_item_id || 'adhoc';
      if (!selectedItems[key]) {
        initial[key] = group.remaining;
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedItems(prev => ({ ...prev, ...initial }));
    }
  }, [groupedAllocations]);

  const consumeMutation = useMutation({
    mutationFn: async (items) => {
      const user = await base44.auth.me();
      const consumedLocation = await base44.entities.InventoryLocation.filter({
        location_code: 'CONSUMED'
      });

      if (!consumedLocation || consumedLocation.length === 0) {
        throw new Error('CONSUMED location not found');
      }

      const consumptionRecords = [];
      
      for (const item of items) {
        const allocation = item.allocations[0]; // Use first allocation as source
        
        const record = {
          project_id: job.project_id,
          job_id: job.id,
          visit_id: job.visit_id || null,
          catalog_item_id: item.catalog_item_id,
          catalog_item_name: item.catalog_item_name,
          description: item.catalog_item_name || 'Ad-hoc item',
          qty_consumed: item.qty_to_consume,
          source_allocation_id: allocation.id,
          consumed_from_location_id: allocation.from_location_id,
          consumed_by_user_id: user.id,
          consumed_by_name: user.full_name || user.email,
          consumed_at: new Date().toISOString()
        };

        const created = await base44.entities.StockConsumption.create(record);
        consumptionRecords.push(created);
      }

      return consumptionRecords;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockAllocations', job.id] });
      queryClient.invalidateQueries({ queryKey: ['stockConsumptions', job.id] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantity'] });
      toast.success('Stock consumed successfully');
      setSelectedItems({});
    },
    onError: (error) => {
      toast.error('Failed to consume stock: ' + error.message);
    }
  });

  const handleConsumeSelected = () => {
    const itemsToConsume = groupedAllocations.filter(group => {
      const key = group.catalog_item_id || 'adhoc';
      const qty = selectedItems[key] || 0;
      return qty > 0;
    }).map(group => {
      const key = group.catalog_item_id || 'adhoc';
      return {
        ...group,
        qty_to_consume: selectedItems[key]
      };
    });

    if (itemsToConsume.length === 0) {
      toast.error('No items selected for consumption');
      return;
    }

    // Check for over-consumption
    const overConsumption = itemsToConsume.find(item => item.qty_to_consume > item.remaining);
    if (overConsumption) {
      setShowOverConsumptionDialog(itemsToConsume);
      return;
    }

    consumeMutation.mutate(itemsToConsume);
  };

  const handleConsumeAll = () => {
    const itemsToConsume = groupedAllocations.filter(group => group.remaining > 0).map(group => ({
      ...group,
      qty_to_consume: group.remaining
    }));

    if (itemsToConsume.length === 0) {
      toast.error('No items to consume');
      return;
    }

    consumeMutation.mutate(itemsToConsume);
  };

  const handleQuantityChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    if (numValue < 0) return;
    setSelectedItems(prev => ({ ...prev, [key]: numValue }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groupedAllocations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Package className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No allocated stock for this job</p>
      </div>
    );
  }

  const hasRemainingStock = groupedAllocations.some(g => g.remaining > 0);

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="text-2xl font-bold">{groupedAllocations.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-2xl font-bold">
                {groupedAllocations.reduce((sum, g) => sum + g.remaining, 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-3">
        {groupedAllocations.map(group => {
          const key = group.catalog_item_id || 'adhoc';
          const isFullyConsumed = group.remaining === 0;
          
          return (
            <Card key={key} className={isFullyConsumed ? 'opacity-50' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-medium">{group.catalog_item_name || 'Ad-hoc item'}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Allocated: {group.total_allocated}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Consumed: {group.total_consumed}
                      </Badge>
                      <Badge variant={group.remaining > 0 ? 'default' : 'secondary'} className="text-xs">
                        Remaining: {group.remaining}
                      </Badge>
                    </div>
                  </div>
                  {isFullyConsumed && (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </div>

                {!isFullyConsumed && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground min-w-[60px]">Consume:</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedItems[key] || 0}
                      onChange={(e) => handleQuantityChange(key, e.target.value)}
                      className="flex-1 min-h-[44px]"
                      inputMode="decimal"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      {hasRemainingStock && (
        <div className="flex gap-2 sticky bottom-0 bg-background pt-4 pb-2">
          <Button
            variant="outline"
            onClick={handleConsumeAll}
            disabled={consumeMutation.isPending}
            className="flex-1 min-h-[44px]"
          >
            Consume All
          </Button>
          <Button
            onClick={handleConsumeSelected}
            disabled={consumeMutation.isPending}
            className="flex-1 min-h-[44px]"
          >
            {consumeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Consuming...
              </>
            ) : (
              'Consume Selected'
            )}
          </Button>
        </div>
      )}

      {/* Over-consumption confirmation dialog */}
      <AlertDialog open={!!showOverConsumptionDialog} onOpenChange={() => setShowOverConsumptionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Over-consumption Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are consuming more than allocated. This may indicate:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Additional parts were used</li>
                <li>Incorrect allocation quantity</li>
              </ul>
              <p className="mt-2 font-medium">Do you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showOverConsumptionDialog) {
                  consumeMutation.mutate(showOverConsumptionDialog);
                }
                setShowOverConsumptionDialog(null);
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Confirm Over-consumption
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}