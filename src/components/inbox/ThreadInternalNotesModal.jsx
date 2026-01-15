import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader, Check } from "lucide-react";

export default function ThreadInternalNotesModal({
  open,
  onClose,
  thread,
  onSaved,
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const autosaveTimer = useRef(null);

  // Load notes when modal opens
  useEffect(() => {
    if (open && thread) {
      setNotes(thread.internal_notes || "");
      setIsSaved(false);
    }
  }, [open, thread]);

  // Autosave with debounce
  useEffect(() => {
    if (!open || !thread) return;

    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        await base44.entities.EmailThread.update(thread.id, {
          internal_notes: notes,
        });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } catch (error) {
        console.error("Autosave failed:", error);
      }
    }, 800);

    return () => clearTimeout(autosaveTimer.current);
  }, [notes, open, thread]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.entities.EmailThread.update(thread.id, {
        internal_notes: notes,
      });
      toast.success("Notes saved");
      onSaved?.();
      onClose();
    } catch (error) {
      console.error("Failed to save notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Internal Notes</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this thread (not sent to customer)..."
            rows={6}
          />
          {isSaved && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <Check className="w-3 h-3" />
              Saved
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}