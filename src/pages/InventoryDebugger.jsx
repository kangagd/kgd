import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import InventoryItemDebugView from '@/components/inventory/InventoryItemDebugView';

export default function InventoryDebugger() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Check auth and role
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser?.role !== 'admin') {
          setUser(null);
          return;
        }
        setUser(currentUser);
      } catch (err) {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  // Search price list items
  const { data: priceListItems = [], isLoading } = useQuery({
    queryKey: ['priceListSearch', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const items = await base44.entities.PriceListItem.list();
      return items.filter(
        item =>
          item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    },
    enabled: searchTerm.length >= 2 && !!user,
  });

  if (!user) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800 font-medium">Access Denied</p>
            <p className="text-red-700 text-sm mt-1">Only admins can access this debug tool.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory Debugger</h1>
        <p className="text-slate-600 text-sm mt-1">View stock levels, locations, and movement history for any item</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Results */}
          {searchTerm.length >= 2 && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {isLoading ? (
                <p className="text-slate-500 text-sm">Searching...</p>
              ) : priceListItems.length === 0 ? (
                <p className="text-slate-500 text-sm">No items found</p>
              ) : (
                priceListItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedItemId === item.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-medium text-slate-900">{item.item}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      {item.sku && <span>SKU: {item.sku}</span>}
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug View */}
      {selectedItemId && <InventoryItemDebugView priceListItemId={selectedItemId} />}
    </div>
  );
}