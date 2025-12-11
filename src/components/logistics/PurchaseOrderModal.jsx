import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PurchaseOrderDetail from "./PurchaseOrderDetail";

export default function PurchaseOrderModal({ poId, open, onClose }) {
  if (!poId) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden max-h-[90vh]">
        <PurchaseOrderDetail
          poId={poId}
          onClose={onClose}
          mode="modal"
        />
      </DialogContent>
    </Dialog>
  );
}