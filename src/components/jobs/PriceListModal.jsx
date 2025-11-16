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
  "Service": "bg-blue-50 text-blue-900 border-blue-200 border-2",
  "Remotes": "bg-purple-50 text-purple-900 border-purple-200 border-2",
  "Accessories": "bg-green-50 text-green-900 border-green-200 border-2",
  "Motor & Rails": "bg-orange-50 text-orange-900 border-orange-200 border-2",
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
      <DialogContent className="max-w-4xl max-h-[85vh] border-2 border-slate-300 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b-2 border-slate-200">
          <DialogTitle className="text-2xl font-bold text-[#000000] tracking-tight">Price List Reference</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl text-base"
            />
          </div>

          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList className="w-full h-12 bg-slate-100">
              <TabsTrigger value="all" className="flex-1 font-semibold">All</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="flex-1 text-xs md:text-sm font-semibold">{cat}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-base font-medium">No items found</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${categoryColors[item.category]} text-xs font-semibold`}>
                            {item.category}
                          </Badge>
                          {!item.in_inventory && (
                            <Badge variant="outline" className="text-xs border-2 font-semibold">Not in stock</Badge>
                          )}
                        </div>
                        <h4 className="font-bold text-[#000000] text-base mb-1">{item.item}</h4>
                        {item.description && (
                          <p className="text-sm text-slate-600 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-2xl font-bold text-[#000000]">
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