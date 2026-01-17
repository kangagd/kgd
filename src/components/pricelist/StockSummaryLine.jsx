import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { calculateOnHandQty, calculateInboundQty } from '@/components/domain/inboundInventoryHelper';

/**
 * Minimal stock summary line for Price List
 * Shows: "Stock: {onHand} on hand · {inbound} inbound"
 * Or: "Stock: Out of stock · {inbound} inbound"
 */
export default function StockSummaryLine({ skuId, trackInventory }) {
  const { data: stockSummary, isLoading } = useQuery({
    queryKey: ['stockSummary', skuId],
    queryFn: async () => {
      if (!skuId || trackInventory === false) return null;
      const [onHand, inbound] = await Promise.all([
        calculateOnHandQty(skuId),
        calculateInboundQty(skuId)
      ]);
      return { onHand, inbound };
    },
    enabled: !!skuId && trackInventory !== false
  });

  if (trackInventory === false) return null;
  if (isLoading) return <span className="text-xs text-slate-400">Loading...</span>;

  const { onHand = 0, inbound = 0 } = stockSummary || {};

  const onHandText = onHand === 0 ? 'Out of stock' : `${onHand} on hand`;
  const inboundText = inbound > 0 ? ` · ${inbound} inbound` : '';

  return (
    <span className="text-xs text-slate-500">
      Stock: {onHandText}{inboundText}
    </span>
  );
}