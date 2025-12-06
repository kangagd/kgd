import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SupplierPurchaseOrderModal from "../components/purchasing/SupplierPurchaseOrderModal";
import ReceivePurchaseOrderModal from "../components/purchasing/ReceivePurchaseOrderModal";
import { ShoppingCart, ExternalLink, CheckCircle2, PackageCheck, Edit2 } from "lucide-react";
import { format } from "date-fns";

const SUPPLIER_TYPES = [
  "Door Manufacturer",
  "Motor Supplier",
  "Hardware",
  "Glass",
  "Steel / Fabrication",
  "Other",
];

function PurchaseOrdersList({ supplierId }) {
  const queryClient = useQueryClient();
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState(null);

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders-by-supplier", supplierId],
    queryFn: () => base44.entities.PurchaseOrder.filter({ supplier_id: supplierId }, "-order_date"),
    enabled: !!supplierId,
  });

  const markAsSentMutation = useMutation({
    mutationFn: async (poId) => {
      await base44.entities.PurchaseOrder.update(poId, {
        status: "sent",
        email_sent_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["purchase-orders-by-supplier", supplierId]);
    }
  });

  if (isLoading) return <div className="py-4 text-center text-gray-500 text-xs">Loading orders...</div>;

  if (purchaseOrders.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No purchase orders found for this supplier.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table className="table-auto w-full text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b bg-gray-50/50">
              <TableHead className="text-[11px] uppercase text-gray-500 h-9">PO Number</TableHead>
              <TableHead className="text-[11px] uppercase text-gray-500 h-9">Date</TableHead>
              <TableHead className="text-[11px] uppercase text-gray-500 h-9">Status</TableHead>
              <TableHead className="text-[11px] uppercase text-gray-500 h-9">Delivery To</TableHead>
              <TableHead className="text-[11px] uppercase text-gray-500 h-9">Amount</TableHead>
              <TableHead className="text-[11px] uppercase text-gray-500 text-right h-9">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id} className="hover:bg-gray-50 transition-colors border-b last:border-0">
                <TableCell className="px-2 py-2 font-medium">{po.po_number || "—"}</TableCell>
                <TableCell className="px-2 py-2">
                  {po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"}
                </TableCell>
                <TableCell className="px-2 py-2">
                  <Badge variant="outline" className={`capitalize text-[10px] px-1.5 py-0 ${
                    po.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    po.status === 'draft' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                    po.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' : 
                    po.status === 'partially_received' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''
                  }`}>
                    {po.status?.replace('_', ' ')}
                  </Badge>
                  {po.email_sent_at && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Sent: {format(new Date(po.email_sent_at), "dd/MM")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-2 py-2">{po.delivery_location_name || "—"}</TableCell>
                <TableCell className="px-2 py-2">${po.total_amount_ex_tax?.toFixed(2) || "0.00"}</TableCell>
                <TableCell className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {po.status === 'draft' && (
                      <Button 
                        size="xs" 
                        variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => markAsSentMutation.mutate(po.id)}
                        disabled={markAsSentMutation.isPending}
                      >
                        <ExternalLink className="w-3 h-3" /> Mark Sent
                      </Button>
                    )}
                    {(po.status === 'sent' || po.status === 'partially_received' || po.status === 'draft') && (
                      <Button 
                        size="xs" 
                        variant="outline"
                        className="h-6 text-[10px] gap-1 border-green-200 hover:bg-green-50 text-green-700"
                        onClick={() => {
                          setSelectedPOId(po.id);
                          setReceiveModalOpen(true);
                        }}
                      >
                        <PackageCheck className="w-3 h-3" /> Receive
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReceivePurchaseOrderModal 
        open={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        purchaseOrderId={selectedPOId}
      />
    </>
  );
}

function SuppliersPage() {
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers-admin"],
    queryFn: () => base44.entities.Supplier.list("name"),
  });

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    type: "",
    contact_name: "",
    phone: "",
    email: "",
    pickup_address: "",
    opening_hours: "",
    notes: "",
    default_lead_time_days: "",
    is_active: true,
  });

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null); // Added missing state
  const [isDialogOpen, setIsDialogOpen] = useState(false); // Added missing state

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newSupplier.name) return;
      await base44.entities.Supplier.create({
        ...newSupplier,
        default_lead_time_days: newSupplier.default_lead_time_days
          ? Number(newSupplier.default_lead_time_days)
          : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["suppliers-admin"]);
      setNewSupplier({
        name: "",
        type: "",
        contact_name: "",
        phone: "",
        email: "",
        pickup_address: "",
        opening_hours: "",
        notes: "",
        default_lead_time_days: "",
        is_active: true,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      return base44.entities.Supplier.update(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["suppliers-admin"]);
    },
  });

  const handleInlineChange = (supplier, field, value) => {
    updateMutation.mutate({
      id: supplier.id,
      patch: {
        [field]:
          field === "default_lead_time_days" && value !== ""
            ? Number(value)
            : value,
      },
    });
  };

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">
            Manage supplier vendors for stock and logistics operations.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="col-span-2 space-y-4">
          {/* List */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">All suppliers</h2>
              <span className="text-[11px] text-gray-500">
                {suppliers.length} total
              </span>
            </div>

            {isLoading ? (
              <p className="text-xs text-gray-500">Loading suppliers…</p>
            ) : !suppliers.length ? (
              <p className="text-xs text-gray-500">
                No suppliers yet. Add your first supplier on the right.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-shell">
                  <TableHeader>
                    <TableRow className="table-row hover:bg-transparent border-b">
                      <TableHead className="table-head h-9">Name</TableHead>
                      <TableHead className="table-head h-9">Type</TableHead>
                      <TableHead className="table-head h-9">Contact</TableHead>
                      <TableHead className="table-head h-9">Phone</TableHead>
                      <TableHead className="table-head h-9">Email</TableHead>
                      <TableHead className="table-head h-9">Lead time</TableHead>
                      <TableHead className="table-head h-9">Active</TableHead>
                      <TableHead className="table-head text-right h-9">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((s) => (
                      <TableRow
                        key={s.id}
                        className={`table-row border-b last:border-0 cursor-pointer ${
                          selectedSupplier?.id === s.id ? "bg-[#FAE008]/5 border-l-2 border-l-[#FAE008]" : ""
                        }`}
                        onClick={() => setSelectedSupplier(s)}
                      >
                        <TableCell className="table-cell">
                          <Input
                            className="input-sm w-full"
                            value={s.name || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(s, "name", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell">
                          <select
                            className="input-sm w-full rounded border border-gray-300 bg-white px-1 text-xs focus:ring-1 focus:ring-[#FAE008] focus:border-[#FAE008]"
                            value={s.type || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(s, "type", e.target.value)
                            }
                          >
                            <option value="">-</option>
                            {SUPPLIER_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="table-cell">
                          <Input
                            className="input-sm w-full"
                            placeholder="Contact name"
                            value={s.contact_name || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(s, "contact_name", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell">
                          <Input
                            className="input-sm w-full"
                            placeholder="Phone"
                            value={s.phone || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(s, "phone", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell">
                          <Input
                            className="input-sm w-full"
                            placeholder="Email"
                            value={s.email || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(s, "email", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell">
                          <Input
                            className="input-sm w-16"
                            type="number"
                            placeholder="0"
                            value={
                              s.default_lead_time_days !== null &&
                              s.default_lead_time_days !== undefined
                                ? String(s.default_lead_time_days)
                                : ""
                            }
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleInlineChange(
                                s,
                                "default_lead_time_days",
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={!!s.is_active}
                              onCheckedChange={(val) =>
                                handleInlineChange(s, "is_active", val)
                              }
                              className="scale-75 origin-left"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="table-cell text-right">
                           <Button
                              variant="ghost"
                              size="xs"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedSupplier(s);
                                 setPoModalOpen(true);
                              }}
                              title="Create Purchase Order"
                           >
                              <ShoppingCart className="w-4 h-4" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Purchase Orders Panel */}
          {selectedSupplier && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="section-title">Purchase Orders</h2>
                    <p className="text-xs text-gray-500">Managing orders for {selectedSupplier.name}</p>
                </div>
                <Button 
                  size="sm"
                  onClick={() => setPoModalOpen(true)}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] h-8 text-xs font-medium"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-2" />
                  Create Order
                </Button>
              </div>
              
              <PurchaseOrdersList supplierId={selectedSupplier.id} />
            </div>
          )}
        </div>

        <SupplierPurchaseOrderModal 
          open={poModalOpen}
          onClose={() => setPoModalOpen(false)}
          supplier={selectedSupplier}
        />

        {/* Create / details */}
        <div className="col-span-1">
          <div className="card sticky top-6">
            <h2 className="mb-4 section-title">
              Add supplier
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="form-label">
                  Name
                </label>
                <Input
                  className="input-sm w-full"
                  value={newSupplier.name}
                  onChange={(e) =>
                    setNewSupplier((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label">
                  Type
                </label>
                <select
                  className="input-sm w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FAE008] focus:border-transparent"
                  value={newSupplier.type}
                  onChange={(e) =>
                    setNewSupplier((s) => ({ ...s, type: e.target.value }))
                  }
                >
                  <option value="">Select type…</option>
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label">
                    Contact name
                  </label>
                  <Input
                    className="input-sm w-full"
                    value={newSupplier.contact_name}
                    onChange={(e) =>
                      setNewSupplier((s) => ({
                        ...s,
                        contact_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="form-label">
                    Phone
                  </label>
                  <Input
                    className="input-sm w-full"
                    value={newSupplier.phone}
                    onChange={(e) =>
                      setNewSupplier((s) => ({ ...s, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  Email
                </label>
                <Input
                  className="input-sm w-full"
                  value={newSupplier.email}
                  onChange={(e) =>
                    setNewSupplier((s) => ({ ...s, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label">
                  Pickup address
                </label>
                <Textarea
                  rows={2}
                  className="textarea-sm w-full min-h-[60px]"
                  value={newSupplier.pickup_address}
                  onChange={(e) =>
                    setNewSupplier((s) => ({
                      ...s,
                      pickup_address: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="form-label">
                  Opening hours
                </label>
                <Input
                  className="input-sm w-full"
                  placeholder="e.g. Mon–Fri 7:00–3:30"
                  value={newSupplier.opening_hours}
                  onChange={(e) =>
                    setNewSupplier((s) => ({
                      ...s,
                      opening_hours: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="form-label">
                  Notes for pickup
                </label>
                <Textarea
                  rows={2}
                  className="textarea-sm w-full min-h-[60px]"
                  placeholder="e.g. Use rear loading dock..."
                  value={newSupplier.notes}
                  onChange={(e) =>
                    setNewSupplier((s) => ({ ...s, notes: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label">
                  Default lead time (days)
                </label>
                <Input
                  type="number"
                  className="input-sm w-full"
                  value={newSupplier.default_lead_time_days}
                  onChange={(e) =>
                    setNewSupplier((s) => ({
                      ...s,
                      default_lead_time_days: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newSupplier.is_active}
                    onCheckedChange={(val) =>
                      setNewSupplier((s) => ({ ...s, is_active: val }))
                    }
                  />
                  <span className="text-[11px] text-gray-600">
                    Active
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-medium"
                  onClick={() => createMutation.mutate()}
                  disabled={!newSupplier.name || createMutation.isLoading}
                >
                  {createMutation.isLoading ? "Saving…" : "Add Supplier"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuppliersPage;