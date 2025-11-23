import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackagePlus, Pencil, Trash2, ChevronDown, AlertCircle, Package } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const categoryColors = {
  "Service": "bg-blue-100 text-blue-700",
  "Motor": "bg-purple-100 text-purple-700",
  "Remotes/Accessories": "bg-green-100 text-green-700"
};

export default function PriceListCard({ item, isAdmin, canModifyStock, onEdit, onDelete, onStockAdjust }) {
  const isLowStock = item.stock_level <= item.min_stock_level && item.stock_level > 0;
  const isOutOfStock = item.stock_level === 0;

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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${categoryColors[item.category] || "bg-slate-100 text-slate-700"} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                    {item.category}
                  </Badge>
                  {isOutOfStock && (
                    <Badge className="bg-red-100 text-red-700 font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                      <Package className="w-3 h-3 mr-1" />
                      Out
                    </Badge>
                  )}
                  {isLowStock && (
                    <Badge className="bg-amber-100 text-amber-700 font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Low
                    </Badge>
                  )}
                </div>
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                  {item.item}
                </h3>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <div className="text-[#111827] text-[22px] font-bold leading-[1.2]">
                    ${item.price.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Info Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[14px] text-[#4B5563] leading-[1.4]">
                <span>
                  Stock: <span className={`font-semibold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-[#111827]'}`}>
                    {item.stock_level}
                  </span>
                </span>
                <span className="text-[#6B7280]">Min: {item.min_stock_level}</span>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-1">
                {canModifyStock && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStockAdjust(item);
                    }}
                    className="h-8 w-8 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg"
                    title="Adjust Stock"
                  >
                    <PackagePlus className="w-4 h-4" />
                  </Button>
                )}
                {isAdmin && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Expandable Details */}
            {(item.description || item.notes) && (
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]">
                <span>Details</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            )}
          </div>

          {(item.description || item.notes) && (
            <CollapsibleContent className="pt-3">
              <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-2">
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