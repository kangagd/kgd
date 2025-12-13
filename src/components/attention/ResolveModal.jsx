import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ResolveModal({ open, onClose, item, onConfirm }) {
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    onConfirm(item.id, note);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Resolved</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            You're about to mark this attention item as resolved:
          </p>
          <p className="font-medium text-sm mb-4">{item?.title}</p>
          
          <div>
            <Label>Resolution Note (optional, max 240 chars)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context about how this was resolved..."
              maxLength={240}
              rows={3}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">{note.length}/240</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}