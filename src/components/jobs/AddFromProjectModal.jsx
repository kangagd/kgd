import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Wrench, FileText } from "lucide-react";

export default function AddFromProjectModal({ 
  open, 
  onClose, 
  onAdd, 
  projectParts = [], 
  projectTrades = [], 
  projectRequirements,
  currentScope 
}) {
  const [selectedItems, setSelectedItems] = useState({
    parts: [],
    trades: [],
    requirements: []
  });

  // Filter out items already in scope
  const existingKeys = new Set([
    ...(currentScope.parts || []).map(p => p.key),
    ...(currentScope.trades || []).map(t => t.key),
    ...(currentScope.requirements || []).map(r => r.key)
  ]);

  const availableParts = projectParts.filter(p => !existingKeys.has(`project:part:${p.id}`));
  const availableTrades = projectTrades.filter(t => !existingKeys.has(`project:trade:${t.id}`));

  const togglePart = (part) => {
    setSelectedItems(prev => {
      const isSelected = prev.parts.some(p => p.id === part.id);
      return {
        ...prev,
        parts: isSelected 
          ? prev.parts.filter(p => p.id !== part.id)
          : [...prev.parts, part]
      };
    });
  };

  const toggleTrade = (trade) => {
    setSelectedItems(prev => {
      const isSelected = prev.trades.some(t => t.id === trade.id);
      return {
        ...prev,
        trades: isSelected 
          ? prev.trades.filter(t => t.id !== trade.id)
          : [...prev.trades, trade]
      };
    });
  };

  const handleConfirm = () => {
    const itemsToAdd = {
      parts: selectedItems.parts.map(part => ({
        key: `project:part:${part.id}`,
        label: part.item_name || part.category || 'Part',
        source: 'project',
        ref_id: part.id,
        status: 'required',
        qty: part.quantity_required || 1
      })),
      trades: selectedItems.trades.map(trade => ({
        key: `project:trade:${trade.id}`,
        label: trade.trade_name || trade.trade_type || 'Trade',
        source: 'project',
        ref_id: trade.id,
        status: 'required'
      })),
      requirements: [] // TODO: If we add structured requirements to projects
    };

    onAdd(itemsToAdd);
  };

  const totalSelected = selectedItems.parts.length + selectedItems.trades.length + selectedItems.requirements.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#111827]">
            Add from Project Requirements
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="parts" className="w-full mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="parts" className="flex-1">
              <Package className="w-4 h-4 mr-1.5" />
              Parts ({availableParts.length})
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex-1">
              <Wrench className="w-4 h-4 mr-1.5" />
              Trades ({availableTrades.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parts" className="mt-4 space-y-2">
            {availableParts.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] text-center py-6">
                All project parts are already in this visit's scope
              </p>
            ) : (
              availableParts.map((part) => (
                <div 
                  key={part.id}
                  onClick={() => togglePart(part)}
                  className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedItems.parts.some(p => p.id === part.id)}
                    onCheckedChange={() => togglePart(part)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#111827] truncate">
                      {part.item_name || part.category || 'Part'}
                    </div>
                    {part.quantity_required && (
                      <div className="text-[12px] text-[#6B7280]">Qty: {part.quantity_required}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="trades" className="mt-4 space-y-2">
            {availableTrades.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] text-center py-6">
                All project trades are already in this visit's scope
              </p>
            ) : (
              availableTrades.map((trade) => (
                <div 
                  key={trade.id}
                  onClick={() => toggleTrade(trade)}
                  className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedItems.trades.some(t => t.id === trade.id)}
                    onCheckedChange={() => toggleTrade(trade)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#111827] truncate">
                      {trade.trade_name || trade.trade_type || 'Trade'}
                    </div>
                    {trade.notes && (
                      <div className="text-[12px] text-[#6B7280] truncate">{trade.notes}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E5E7EB]">
          <span className="text-[13px] text-[#6B7280]">
            {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={totalSelected === 0}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              Add to Visit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}