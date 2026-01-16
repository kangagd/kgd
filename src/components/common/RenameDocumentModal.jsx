import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RenameDocumentModal({ open, onClose, onConfirm, currentName, documentType = "Document" }) {
  const [name, setName] = useState(currentName || "");

  React.useEffect(() => {
    setName(currentName || "");
  }, [currentName, open]);

  const handleSubmit = () => {
    if (name.trim()) {
      onConfirm(name.trim());
      setName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Rename {documentType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="docname" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="docname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${documentType.toLowerCase()} name`}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}