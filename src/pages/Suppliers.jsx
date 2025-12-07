import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShoppingCart, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import SupplierForm from "../components/suppliers/SupplierForm";
import SupplierDetails from "../components/suppliers/SupplierDetails";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list", "form", "details"
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers-admin"],
    queryFn: () => base44.entities.Supplier.list("name"),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Supplier.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["suppliers-admin"]);
      setViewMode("list");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Supplier.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["suppliers-admin"]);
      // If we were editing from details, go back to details? Or list? 
      // Usually go back to details if that's where we started, but simplified flow: go to list or stay in details
      if (selectedSupplier) {
        // Refresh selected supplier data locally or re-fetch?
        // Simplest is to go back to list or keep selected
        // Let's go back to details view with updated data (React Query handles data refresh)
        setViewMode("details");
        // We need to ensure selectedSupplier is updated. 
        // Actually selectedSupplier might be stale.
        // Ideally we pass ID and let SupplierDetails fetch, or we update selectedSupplier.
        // For now, let's switch to list to be safe/simple.
        setViewMode("list");
        setSelectedSupplier(null);
      } else {
        setViewMode("list");
      }
    },
  });

  const handleSubmit = (data) => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setViewMode("form");
  };

  const handleViewDetails = (supplier) => {
    setSelectedSupplier(supplier);
    setViewMode("details");
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (viewMode === "form") {
    return (
      <div className="page-container p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <SupplierForm 
          supplier={editingSupplier} 
          onSubmit={handleSubmit} 
          onCancel={() => {
            setViewMode(selectedSupplier ? "details" : "list");
            setEditingSupplier(null);
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    );
  }

  if (viewMode === "details" && selectedSupplier) {
    return (
      <div className="page-container p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <SupplierDetails 
            supplier={selectedSupplier} 
            onClose={() => {
                setViewMode("list");
                setSelectedSupplier(null);
            }}
            onEdit={handleEdit}
        />
      </div>
    );
  }

  return (
    <div className="page-container p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <BackButton to={createPageUrl("Dashboard")} />
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Suppliers</h1>
          <p className="text-sm text-[#4B5563] mt-1">
            Manage supplier vendors for stock and logistics operations.
          </p>
        </div>
        <Button 
            onClick={() => {
                setEditingSupplier(null);
                setViewMode("form");
            }}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
        >
            <Plus className="w-4 h-4 mr-2" />
            New Supplier
        </Button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
            />
        </div>
      </div>

      <div className="card rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No suppliers found</h3>
                <p className="text-gray-500 mt-1">Get started by creating a new supplier.</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <Table className="table-auto w-full text-xs">
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-transparent border-b">
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold">Name</TableHead>
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold">Type</TableHead>
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold">Contact</TableHead>
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold">Fulfilment</TableHead>
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold">Delivery Days</TableHead>
                            <TableHead className="text-[11px] uppercase text-gray-500 h-10 font-semibold text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSuppliers.map((s) => (
                            <TableRow 
                                key={s.id} 
                                className="hover:bg-gray-50 transition-colors border-b last:border-0 cursor-pointer"
                                onClick={() => handleViewDetails(s)}
                            >
                                <TableCell className="px-4 py-3 font-medium text-gray-900">{s.name}</TableCell>
                                <TableCell className="px-4 py-3 text-gray-600">{s.type || "—"}</TableCell>
                                <TableCell className="px-4 py-3 text-gray-600">{s.contact_name || "—"}</TableCell>
                                
                                <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <Select 
                                        value={s.fulfilment_preference || "pickup"} 
                                        onValueChange={(val) => updateMutation.mutate({ id: s.id, data: { fulfilment_preference: val } })}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-[100px] bg-white border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pickup">Pickup</SelectItem>
                                            <SelectItem value="delivery">Delivery</SelectItem>
                                            <SelectItem value="mixed">Mixed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>

                                <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    {(s.fulfilment_preference === 'delivery' || s.fulfilment_preference === 'mixed') ? (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start bg-white border-gray-200 font-normal text-gray-600">
                                                    {s.delivery_days ? <span className="truncate max-w-[120px]">{s.delivery_days}</span> : "Select Days"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" align="start">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-xs text-gray-900">Delivery Days</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                                            <div key={day} className="flex items-center gap-2">
                                                                <Checkbox 
                                                                    id={`day-${s.id}-${day}`} 
                                                                    checked={(s.delivery_days || "").split(',').includes(day)}
                                                                    onCheckedChange={(checked) => {
                                                                        const currentDays = s.delivery_days ? s.delivery_days.split(',') : [];
                                                                        let newDays;
                                                                        if (checked) {
                                                                            if (!currentDays.includes(day)) newDays = [...currentDays, day];
                                                                            else newDays = currentDays;
                                                                        } else {
                                                                            newDays = currentDays.filter(d => d !== day);
                                                                        }
                                                                        const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                                                                        newDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
                                                                        updateMutation.mutate({ id: s.id, data: { delivery_days: newDays.join(',') } });
                                                                    }}
                                                                />
                                                                <label htmlFor={`day-${s.id}-${day}`} className="text-xs cursor-pointer">{day}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    ) : (
                                        <span className="text-gray-300 text-xs pl-2">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="px-4 py-3 text-center">
                                    {s.is_active ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">Active</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 font-normal">Inactive</Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )}
      </div>
    </div>
  );
}

export default SuppliersPage;