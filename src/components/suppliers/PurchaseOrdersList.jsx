import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ExternalLink, PackageCheck } from "lucide-react";
import { format } from "date-fns";
import ReceivePurchaseOrderModal from "../purchasing/ReceivePurchaseOrderModal";

export default function PurchaseOrdersList({ supplierId, onSelectPO }) {
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
      await base44.functions.invoke("managePurchaseOrder", { 
        action: "markAsSent", 
        id: poId 
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
              <TableRow 
                key={po.id} 
                className="hover:bg-gray-50 transition-colors border-b last:border-0 cursor-pointer"
                onClick={() => onSelectPO && onSelectPO(po)}
              >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsSentMutation.mutate(po.id);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
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