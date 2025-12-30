import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function MarkLostModal({ sample, open, onClose }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const markLostMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.functions.invoke('manageSample', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sampleMovements'] });
      toast.success('Sample marked as lost');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to mark sample as lost');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    markLostMutation.mutate({
      action: 'markLost',
      sample_id: sample.id,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Mark Sample as Lost
          </DialogTitle>
        </DialogHeader>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-[13px] text-red-800">
            This will mark the sample as lost and set its location to unknown. All checkout information will be cleared.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Sample</Label>
            <div className="text-[14px] font-medium text-[#111827] p-2 bg-[#F9FAFB] rounded">
              {sample.name}
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe circumstances of loss..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={markLostMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {markLostMutation.isPending ? 'Marking as Lost...' : 'Mark as Lost'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}