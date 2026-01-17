import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackagePlus, Pencil, Trash2, ChevronDown, AlertCircle, Package, ArrowRightLeft } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StockByLocationView from "@/components/inventory/StockByLocationView";
import StockSummaryLine from "@/components/pricelist/StockSummaryLine";

export default function PriceListCard({ item, isAdmin, canModifyStock, onEdit, onDelete, onStockAdjust, onMoveStock, inventorySummary, stockByLocation, locations, canViewCosts }) {
  // Derive on-hand stock from InventoryQuantity only (sum across ALL physical locations)
  // stockByLocation is pre-filtered to only include physical (warehouse+vehicle) locations
  const onHandTotal = Array.isArray(stockByLocation) 
    ? stockByLocation.reduce((sum, q) => sum + (q.quantity || 0), 0) 
    : 0;
  const isLowStock = onHandTotal <= item.min_stock_level && onHandTotal > 0;
  const isOutOfStock = onHandTotal === 0;

  if (item.is_active === false && !isAdmin) return null;

  return (
    <Card 
      className={`hover:shadow-lg transition-all duration-200 border rounded-xl ${
        isOutOfStock ? 'border-red-200' : isLowStock ? 'border-amber-200' : 'border-[#E5E7EB]'
      }`}
    >
      <CardContent className="p-4">
        <Collapsible>
          <div className="space-y-3">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
              {item.image_url && (
                <img 
                  src={item.image_url} 
                  alt={item.item} 
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-slate-100 text-slate-700 font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                    {item.category}
                  </Badge>
                  {(item.track_inventory !== false && item.in_inventory !== false) && isOutOfStock && (
                    <Badge className="bg-red-100 text-red-700 font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                      <Package className="w-3 h-3 mr-1" />
                      Out
                    </Badge>
                  )}
                  {(item.track_inventory !== false && item.in_inventory !== false) && isLowStock && (
                    <Badge className="bg-amber-100 text-amber-700 font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Low
                    </Badge>
                  )}
                </div>
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                  {item.item}
                </h3>
                {(item.sku || item.brand) && (
                  <div className="text-xs text-slate-500 mt-1">
                    {item.brand && <span className="font-medium mr-2">{item.brand}</span>}
                    {item.sku && <span>SKU: {item.sku}</span>}
                  </div>
                )}
              </div>
              
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <div className="text-[#111827] text-[22px] font-bold leading-[1.2]">
                    ${item.price.toFixed(2)}
                  </div>
                  {canViewCosts && (
                    <div className="text-xs text-slate-400 mt-1 font-normal">
                      <div>Cost: ${item.unit_cost?.toFixed(2) || '0.00'}</div>
                      <div>Margin: {item.target_margin || 0}%</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stock Summary Line - Minimal, muted */}
            <div className="pt-1">
              <StockSummaryLine skuId={item.id} trackInventory={item.track_inventory} />
            </div>

            {/* Admin Quick Actions - Only price edit and delete */}
            {isAdmin && (
              <div className="flex items-center justify-end gap-1 pt-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="h-8 w-8 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="h-8 w-8 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Expandable Details */}
            {(item.description || item.notes || (item.track_inventory !== false && stockByLocation?.length > 0)) && (
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]">
                <span>Stock details</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            )}
          </div>

          {(item.description || item.notes || (item.track_inventory !== false && stockByLocation?.length > 0)) && (
            <CollapsibleContent className="pt-3">
              <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-3">
                {item.description && (
                  <div>
                    <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1">Description</div>
                    <p className="text-[14px] text-[#4B5563] leading-[1.4] whitespace-pre-wrap">{item.description}</p>
                  </div>
                )}
                {item.notes && (
                  <div>
                    <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1">Notes</div>
                    <p className="text-[14px] text-[#4B5563] leading-[1.4] italic">{item.notes}</p>
                  </div>
                )}
                {item.track_inventory !== false && stockByLocation?.length > 0 && (
                  <div className="pt-2 border-t border-[#E5E7EB] space-y-3">
                    <div>
                      <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-2">Stock by location</div>
                      <div className="space-y-1">
                        {stockByLocation.map((qty, idx) => (
                          <div key={idx} className="flex justify-between text-[13px] text-[#4B5563]">
                            <span>{qty.location_name}</span>
                            <span className={`font-semibold ${qty.quantity === 0 ? 'text-red-600' : 'text-[#111827]'}`}>
                              {qty.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Stock Actions - Admin only, visible in expanded view */}
                    {(isAdmin || canModifyStock) && (
                      <div className="pt-2 border-t border-[#E5E7EB] flex gap-2 flex-wrap">
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStockAdjust(item);
                            }}
                            className="text-xs text-[#6B7280] hover:text-[#111827] hover:underline font-medium transition-colors"
                          >
                            Adjust stock (admin)
                          </button>
                        )}
                        {onMoveStock && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveStock(item);
                            }}
                            className="text-xs text-[#6B7280] hover:text-[#111827] hover:underline font-medium transition-colors"
                          >
                            Transfer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!item.in_inventory && (
                  <Badge variant="outline" className="text-[#6B7280] text-[12px]">Not in inventory</Badge>
                )}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}