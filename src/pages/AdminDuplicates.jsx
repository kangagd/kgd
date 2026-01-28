import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCw, Copy, Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import ContractEmailSection from '@/components/contracts/ContractEmailSection';

export default function AdminDuplicates() {
  const [user, setUser] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleRunAudit = async () => {
    try {
      setIsLoading(true);
      const response = await base44.functions.invoke('auditDuplicates', {});
      if (response.data?.success) {
        setAuditData(response.data);
        toast.success('Audit completed');
      } else {
        toast.error(response.data?.error || 'Audit failed');
      }
    } catch (err) {
      toast.error('Error running audit: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(auditData, null, 2));
    toast.success('Copied to clipboard');
  };

  const downloadCSV = () => {
    let csv = 'Duplicates Audit Report\n';
    csv += `Generated: ${new Date().toISOString()}\n\n`;

    // Price List Summary
    csv += 'PRICE LIST DUPLICATES\n';
    csv += `SKU Duplicates: ${auditData.summary.priceListSkuDuplicates}\n`;
    csv += `Name Duplicates: ${auditData.summary.priceListNameDuplicates}\n\n`;

    // Inventory Location Summary
    csv += 'INVENTORY LOCATION DUPLICATES\n';
    csv += `Multiple Active Warehouses: ${auditData.summary.multipleActiveWarehouses}\n`;
    csv += `Vehicle Location Duplicates: ${auditData.summary.vehicleLocationDuplicates}\n`;
    csv += `Name/Type Duplicates: ${auditData.summary.nameTypeDuplicates}\n\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duplicates-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!user) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800 font-medium">Access Denied</p>
            <p className="text-red-700 text-sm mt-1">Only admins can access this audit tool.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          Duplicates Audit
        </h1>
        <p className="text-slate-600 text-sm mt-1">Find and audit duplicate items and locations (read-only)</p>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunAudit}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Running...' : 'Run Audit'}
            </Button>

            {auditData && (
              <>
                <Button
                  variant="outline"
                  onClick={copyToClipboard}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadCSV}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </Button>
              </>
            )}
          </div>
          {auditData && (
            <p className="text-xs text-slate-500 mt-3">
              Last run: {new Date(auditData.timestamp).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {auditData && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600">Price List Items</p>
                  <p className="text-xl font-bold text-slate-900">{auditData.summary.totalPriceListItems}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-800 font-medium">SKU Duplicates</p>
                  <p className="text-xl font-bold text-amber-900">{auditData.summary.priceListSkuDuplicates}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-800 font-medium">Name Duplicates</p>
                  <p className="text-xl font-bold text-amber-900">{auditData.summary.priceListNameDuplicates}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600">Total Locations</p>
                  <p className="text-xl font-bold text-slate-900">{auditData.summary.totalLocations}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price List Duplicates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price List Duplicates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {auditData.priceListDuplicates.bySku.length === 0 &&
              auditData.priceListDuplicates.byNormalizedName.length === 0 ? (
                <p className="text-slate-500 text-sm">✓ No duplicates found</p>
              ) : (
                <>
                  {/* By SKU */}
                  {auditData.priceListDuplicates.bySku.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Badge variant="destructive">{auditData.priceListDuplicates.bySku.length}</Badge>
                        Duplicate SKUs
                      </h4>
                      <div className="space-y-2">
                        {auditData.priceListDuplicates.bySku.map((group, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="font-mono text-sm font-medium text-slate-900">SKU: {group.sku}</p>
                            <div className="text-xs text-slate-600 mt-2 space-y-1">
                              {group.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <span>{item.name}</span>
                                  {item.is_active === false && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By Name */}
                  {auditData.priceListDuplicates.byNormalizedName.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Badge variant="destructive">{auditData.priceListDuplicates.byNormalizedName.length}</Badge>
                        Duplicate Names
                      </h4>
                      <div className="space-y-2">
                        {auditData.priceListDuplicates.byNormalizedName.map((group, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="font-medium text-sm text-slate-900 italic">"{group.normalizedName}"</p>
                            <div className="text-xs text-slate-600 mt-2 space-y-1">
                              {group.items.map((item) => (
                                <div key={item.id || Math.random()} className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-slate-500">{item.id ? item.id.substring(0, 8) : 'N/A'}</span>
                                  <span>{item.name || 'Unnamed'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Inventory Location Duplicates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory Location Duplicates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {auditData.inventoryLocationDuplicates.multipleWarehousesActive.length === 0 &&
              auditData.inventoryLocationDuplicates.vehicleLocationDuplicates.length === 0 &&
              auditData.inventoryLocationDuplicates.nameTypeDuplicates.length === 0 ? (
                <p className="text-slate-500 text-sm">✓ No duplicates found</p>
              ) : (
                <>
                  {/* Multiple Warehouses */}
                  {auditData.inventoryLocationDuplicates.multipleWarehousesActive.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Badge variant="destructive">
                          {auditData.inventoryLocationDuplicates.multipleWarehousesActive.length}
                        </Badge>
                        Multiple Active Warehouses
                      </h4>
                      <div className="space-y-2">
                        {auditData.inventoryLocationDuplicates.multipleWarehousesActive.map((loc) => (
                          <div key={loc.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="font-medium text-slate-900">{loc.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{loc.id}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vehicle Duplicates */}
                  {auditData.inventoryLocationDuplicates.vehicleLocationDuplicates.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Badge variant="destructive">
                          {auditData.inventoryLocationDuplicates.vehicleLocationDuplicates.length}
                        </Badge>
                        Duplicate Vehicle Locations
                      </h4>
                      <div className="space-y-2">
                        {auditData.inventoryLocationDuplicates.vehicleLocationDuplicates.map((group, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="font-medium text-slate-900">Vehicle ID: {group.vehicle_id}</p>
                            <div className="text-xs text-slate-600 mt-2 space-y-1">
                              {group.location_names.map((name, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Name + Type Duplicates */}
                  {auditData.inventoryLocationDuplicates.nameTypeDuplicates.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Badge variant="destructive">
                          {auditData.inventoryLocationDuplicates.nameTypeDuplicates.length}
                        </Badge>
                        Duplicate Name + Type
                      </h4>
                      <div className="space-y-2">
                        {auditData.inventoryLocationDuplicates.nameTypeDuplicates.map((group, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="font-medium text-slate-900">
                              {group.type} — {group.name}
                            </p>
                            <div className="text-xs text-slate-600 mt-2 space-y-1">
                              {group.locations.map((loc) => (
                                <div key={loc.id} className="flex items-center gap-2">
                                  <span>{loc.name}</span>
                                  {loc.is_active === false && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}