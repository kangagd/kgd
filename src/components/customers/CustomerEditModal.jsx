import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import CustomerForm from "./CustomerForm";

export default function CustomerEditModal({ customer, open, onClose, onSubmit, isSubmitting }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <CustomerForm
          customer={customer}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}