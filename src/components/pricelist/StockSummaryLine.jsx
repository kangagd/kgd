import React from 'react';

/**
 * Minimal stock summary line for Price List
 * Shows: "Stock: {onHand} on hand · {inbound} inbound"
 * Or: "Stock: Out of stock · {inbound} inbound"
 * 
 * IMPORTANT: This receives pre-calculated onHand (from stockByLocation) and inbound
 * to ensure it always matches the expanded stock view.
 */
export default function StockSummaryLine({ onHand = 0, inbound = 0, trackInventory }) {
  if (trackInventory === false) return null;

  const onHandText = onHand === 0 ? 'Out of stock' : `${onHand} on hand`;
  const inboundText = inbound > 0 ? ` · ${inbound} inbound` : '';

  return (
    <span className="text-xs text-slate-500">
      Stock: {onHandText}{inboundText}
    </span>
  );
}