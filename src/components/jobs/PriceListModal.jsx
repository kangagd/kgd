import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const categoryColors = {
  "Service": "bg-blue-100 text-blue-800",
  "Remotes": "bg-purple-100 text-purple-800",
  "Accessories": "bg-green-100 text-green-800",
  "Motor & Rails": "bg-orange-100 text-orange-800",
};

export default function PriceListModal({ open, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: priceItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('category'),
    enabled: open,
  });

  const filteredItems = priceItems.filter(item => {
    const matchesSearch = 
      item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const categories = ["Service", "Remotes", "Accessories", "Motor & Rails"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Price List Reference</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">{cat}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No items found
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${categoryColors[item.category]} text-xs`}>
                            {item.category}
                          </Badge>
                          {!item.in_inventory && (
                            <Badge variant="outline" className="text-xs">Not in stock</Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-1">{item.item}</h4>
                        {item.description && (
                          <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold text-orange-600">
                          ${item.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}