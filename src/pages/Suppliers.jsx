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
import { ShoppingCart, ExternalLink, CheckCircle2, PackageCheck } from "lucide-react";
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

  if (isLoading) return <div className="py-4 text-center text-gray-500">Loading orders...</div>;

  if (purchaseOrders.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No purchase orders found for this supplier.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery To</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.po_number || "—"}</TableCell>
                <TableCell>
                  {po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`capitalize ${
                    po.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    po.status === 'draft' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                    po.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' : 
                    po.status === 'partially_received' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''
                  }`}>
                    {po.status?.replace('_', ' ')}
                  </Badge>
                  {po.email_sent_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      Sent: {format(new Date(po.email_sent_at), "dd/MM")}
                    </div>
                  )}
                </TableCell>
                <TableCell>{po.delivery_location_name || "—"}</TableCell>
                <TableCell>${po.total_amount_ex_tax?.toFixed(2) || "0.00"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {po.status === 'draft' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => markAsSentMutation.mutate(po.id)}
                        disabled={markAsSentMutation.isPending}
                      >
                        <ExternalLink className="w-3 h-3" /> Mark Sent
                      </Button>
                    )}
                    {(po.status === 'sent' || po.status === 'partially_received' || po.status === 'draft') && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-xs gap-1 border-green-200 hover:bg-green-50 text-green-700"
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
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Suppliers</h1>
          <p className="text-xs text-gray-500">
            Manage suppliers used for parts, price lists and pickup logistics jobs.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
        {/* List */}
        <div className="rounded-xl border bg-white p-3 md:p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">All suppliers</h2>
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
              <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                <thead className="text-[11px] uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Type</th>
                    <th className="px-2 py-1 text-left">Contact</th>
                    <th className="px-2 py-1 text-left">Phone</th>
                    <th className="px-2 py-1 text-left">Email</th>
                    <th className="px-2 py-1 text-left">Lead time (days)</th>
                    <th className="px-2 py-1 text-left">Active</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className={`rounded-lg align-top transition-colors ${
                        selectedSupplier?.id === s.id ? "bg-[#FAE008]/10 border border-[#FAE008]" : "bg-slate-50 hover:bg-slate-100"
                      }`}
                      onClick={() => setSelectedSupplier(s)}
                    >
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          value={s.name || ""}
                          onChange={(e) =>
                            handleInlineChange(s, "name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className="h-7 w-full rounded border border-gray-300 bg-white px-1 text-xs"
                          value={s.type || ""}
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
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Contact name"
                          value={s.contact_name || ""}
                          onChange={(e) =>
                            handleInlineChange(s, "contact_name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Phone"
                          value={s.phone || ""}
                          onChange={(e) =>
                            handleInlineChange(s, "phone", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Email"
                          value={s.email || ""}
                          onChange={(e) =>
                            handleInlineChange(s, "email", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          type="number"
                          placeholder="0"
                          value={
                            s.default_lead_time_days !== null &&
                            s.default_lead_time_days !== undefined
                              ? String(s.default_lead_time_days)
                              : ""
                          }
                          onChange={(e) =>
                            handleInlineChange(
                              s,
                              "default_lead_time_days",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={!!s.is_active}
                            onCheckedChange={(val) =>
                              handleInlineChange(s, "is_active", val)
                            }
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                         <Button
                            variant="ghost"
                            size="icon"
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purchase Orders Panel */}
        {selectedSupplier && (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                  <h2 className="text-sm font-semibold text-gray-900">Purchase Orders</h2>
                  <p className="text-xs text-gray-500">Managing orders for {selectedSupplier.name}</p>
              </div>
              <Button 
                size="sm"
                onClick={() => setPoModalOpen(true)}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] text-xs h-8"
              >
                <ShoppingCart className="w-3 h-3 mr-2" />
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
        <div className="rounded-xl border bg-white p-3 md:p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Add supplier
          </h2>
          <div className="space-y-2 text-xs">
            <div>
              <label className="mb-1 block text-[11px] text-gray-600">
                Name
              </label>
              <Input
                className="h-8 text-xs"
                value={newSupplier.name}
                onChange={(e) =>
                  setNewSupplier((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-gray-600">
                Type
              </label>
              <select
                className="h-8 w-full rounded border border-gray-300 bg-white px-1 text-xs"
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

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-600">
                  Contact name
                </label>
                <Input
                  className="h-8 text-xs"
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
                <label className="mb-1 block text-[11px] text-gray-600">
                  Phone
                </label>
                <Input
                  className="h-8 text-xs"
                  value={newSupplier.phone}
                  onChange={(e) =>
                    setNewSupplier((s) => ({ ...s, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-gray-600">
                Email
              </label>
              <Input
                className="h-8 text-xs"
                value={newSupplier.email}
                onChange={(e) =>
                  setNewSupplier((s) => ({ ...s, email: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-gray-600">
                Pickup address
              </label>
              <Textarea
                rows={2}
                className="text-xs"
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
              <label className="mb-1 block text-[11px] text-gray-600">
                Opening hours
              </label>
              <Input
                className="h-8 text-xs"
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
              <label className="mb-1 block text-[11px] text-gray-600">
                Notes for pickup
              </label>
              <Textarea
                rows={2}
                className="text-xs"
                placeholder="e.g. Use rear loading dock, call on arrival, bring order number…"
                value={newSupplier.notes}
                onChange={(e) =>
                  setNewSupplier((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-gray-600">
                Default lead time (days)
              </label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={newSupplier.default_lead_time_days}
                onChange={(e) =>
                  setNewSupplier((s) => ({
                    ...s,
                    default_lead_time_days: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newSupplier.is_active}
                  onCheckedChange={(val) =>
                    setNewSupplier((s) => ({ ...s, is_active: val }))
                  }
                />
                <span className="text-[11px] text-gray-600">
                  Supplier is active
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!newSupplier.name || createMutation.isLoading}
              >
                {createMutation.isLoading ? "Saving…" : "Add supplier"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuppliersPage;