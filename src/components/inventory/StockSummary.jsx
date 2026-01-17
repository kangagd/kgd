/**
 * VISUAL STANDARD: Stock summary component
 * Shows On Hand, Inbound, Last Movement consistently across all UIs
 * Used in: Price List, Vehicle stock, Warehouse inventory, SKU detail panels, Parts selectors
 */

import React from 'react';
import { TrendingUp, TrendingDown, Clock, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function StockSummary({ 
  onHand = 0, 
  inbound = 0, 
  lastMovement = null,
  compact = false,
  className = ''
}) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-[12px] ${className}`}>
        <span className="font-semibold text-[#111827]">
          On Hand: {Math.round(onHand)}
        </span>
        {inbound > 0 && (
          <span className="text-[#6B7280]">
            Inbound: {Math.round(inbound)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 text-[13px] ${className}`}>
      {/* On Hand */}
      <div className="flex flex-col gap-0.5">
        <div className="text-[#6B7280] font-medium uppercase text-[11px] leading-[1.35]">
          On Hand
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[#111827] font-bold text-[18px] leading-[1.2]">
            {Math.round(onHand)}
          </span>
        </div>
      </div>

      {/* Inbound */}
      <div className="flex flex-col gap-0.5">
        <div className="text-[#6B7280] font-medium uppercase text-[11px] leading-[1.35]">
          Inbound
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-semibold text-[16px] leading-[1.2] ${inbound > 0 ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}>
            {Math.round(inbound)}
          </span>
        </div>
      </div>

      {/* Last Movement */}
      <div className="flex flex-col gap-0.5">
        <div className="text-[#6B7280] font-medium uppercase text-[11px] leading-[1.35]">
          Last
        </div>
        <div className="text-[#6B7280] text-[12px] leading-[1.35]">
          {lastMovement ? (
            <div className="flex items-center gap-1">
              {lastMovement.source === 'po_receipt' && <TrendingUp className="w-3 h-3" />}
              {lastMovement.source === 'job_usage' && <TrendingDown className="w-3 h-3" />}
              {!['po_receipt', 'job_usage'].includes(lastMovement.source) && <Package className="w-3 h-3" />}
              <span>
                {formatDistanceToNow(new Date(lastMovement.performed_at), { addSuffix: true })}
              </span>
            </div>
          ) : (
            <span className="text-[#D1D5DB] italic">—</span>
          )}
        </div>
      </div>
    </div>
  );
}