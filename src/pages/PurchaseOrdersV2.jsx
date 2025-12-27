import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as poApi from "@/components/api/purchaseOrdersV2Api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  in_transit: "bg-purple-100 text-purple-800",
  arrived: "bg-green-100 text-green-800",
  put_away: "bg-teal-100 text-teal-800",
  closed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-800"
};

export default function PurchaseOrdersV2() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [showNewProjectPO, setShowNewProjectPO] = useState(false);
  const [showNewStockPO, setShowNewStockPO] = useState(false);

  // Fetch data
  const { data: purchaseOrders = [], isLoading: loadingPOs } = useQuery({
    queryKey: ['purchaseOrdersV2'],
    queryFn: () => base44.entities.PurchaseOrderV2.list('-created_date')
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name')
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.filter({ status: { $ne: 'Lost' } }, '-created_date', 100)
  });

  // Filter POs
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = !searchTerm || 
      po.po_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
    const matchesType = filterType === 'all' || po.type === filterType;
    const matchesSupplier = filterSupplier === 'all' || po.supplier_id === filterSupplier;

    return matchesSearch && matchesStatus && matchesType && matchesSupplier;
  });

  // Create PO mutation
  const createPOMutation = useMutation({
    mutationFn: poApi.createDraft,
    onSuccess: (po) => {
      queryClient.invalidateQueries(['purchaseOrdersV2']);
      toast.success(`Created ${po.po_ref}`);
      setShowNewProjectPO(false);
      setShowNewStockPO(false);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders V2</h1>
          <p className="text-gray-600">Manage purchase orders and stock procurement</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewProjectPO} onOpenChange={setShowNewProjectPO}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Project PO
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project Purchase Order</DialogTitle>
              </DialogHeader>
              <NewProjectPOForm
                projects={projects}
                suppliers={suppliers}
                onSubmit={(data) => createPOMutation.mutate({ type: 'project', ...data })}
                isLoading={createPOMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showNewStockPO} onOpenChange={setShowNewStockPO}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                New Stock PO
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Stock Purchase Order</DialogTitle>
              </DialogHeader>
              <NewStockPOForm
                suppliers={suppliers}
                onSubmit={(data) => createPOMutation.mutate({ type: 'stock', ...data })}
                isLoading={createPOMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search POs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="put_away">Put Away</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      {loadingPOs ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredPOs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No purchase orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPOs.map(po => (
            <Link key={po.id} to={createPageUrl('PurchaseOrderV2Detail', `id=${po.id}`)}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-semibold text-lg">{po.po_ref}</div>
                        {po.name && <div className="text-sm text-gray-600">{po.name}</div>}
                      </div>
                      <Badge className={STATUS_COLORS[po.status] || "bg-gray-100"}>
                        {po.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline">{po.type}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{po.supplier_name}</div>
                      {po.expected_date && (
                        <div className="text-xs text-gray-500">
                          Expected: {new Date(po.expected_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectPOForm({ projects, suppliers, onSubmit, isLoading }) {
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <Label>Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger>
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.project_number} - {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Supplier (optional)</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger>
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>None</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={() => onSubmit({ project_id: projectId, supplier_id: supplierId || undefined })}
        disabled={!projectId || isLoading}
        className="w-full"
      >
        Create
      </Button>
    </div>
  );
}

function NewStockPOForm({ suppliers, onSubmit, isLoading }) {
  const [supplierId, setSupplierId] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <Label>Supplier</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger>
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={() => onSubmit({ supplier_id: supplierId })}
        disabled={!supplierId || isLoading}
        className="w-full"
      >
        Create
      </Button>
    </div>
  );
}