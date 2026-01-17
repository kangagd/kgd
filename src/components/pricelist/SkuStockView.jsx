import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, AlertCircle } from 'lucide-react';
import { calculateOnHandQty, calculateInboundQty } from '@/components/domain/inboundInventoryHelper';

/**
 * Show On Hand vs Inbound stock view for a SKU
 * Option A: Inbound is derived from open POs, not pre-created in inventory
 */
export default function SkuStockView({ skuId, itemName }) {
  const { data: stockView, isLoading } = useQuery({
    queryKey: ['skuStockView', skuId],
    queryFn: async () => {
      if (!skuId) return { onHand: 0, inbound: 0 };
      
      const [onHand, inbound] = await Promise.all([
        calculateOnHandQty(skuId),
        calculateInboundQty(skuId)
      ]);

      return { onHand, inbound };
    },
    enabled: !!skuId
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading stock...</div>;
  }

  const { onHand = 0, inbound = 0 } = stockView || {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-5 h-5" />
          Stock View
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* On Hand */}
        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-900">On Hand</span>
          </div>
          <Badge className="bg-emerald-600 text-white font-mono text-base">
            {onHand}
          </Badge>
        </div>

        {/* Inbound */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Inbound</span>
            <span className="text-xs text-blue-600">(Open POs)</span>
          </div>
          <Badge className="bg-blue-600 text-white font-mono text-base">
            {inbound}
          </Badge>
        </div>

        {/* Total Available */}
        <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
          <span className="text-sm font-semibold text-slate-900">Total Available</span>
          <Badge variant="secondary" className="font-mono text-base">
            {onHand + inbound}
          </Badge>
        </div>

        {/* Info */}
        {inbound > 0 && (
          <div className="flex gap-2 text-xs text-slate-600 p-2 bg-slate-50 rounded">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Inbound</strong> shows stock on order from open purchase orders. 
              It becomes On Hand when received.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}