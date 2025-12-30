import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CheckoutSampleModal({ open, onClose, sample, projects }) {
  const [projectId, setProjectId] = useState('');
  const [dueBackAt, setDueBackAt] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('manageSampleV2', {
        action: 'checkoutToProject',
        sample_id: sample.id,
        project_id: projectId,
        due_back_at: dueBackAt || null,
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samplesV2'] });
      toast.success('Sample checked out successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to checkout sample: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectId) {
      toast.error('Please select a project');
      return;
    }
    checkoutMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout Sample to Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
            <p className="text-[13px] text-[#6B7280]">Sample</p>
            <p className="text-[14px] font-medium text-[#111827]">{sample.name}</p>
          </div>

          <div>
            <Label htmlFor="project">Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} ({p.customer_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="due_back_at">Due Back Date (Optional)</Label>
            <Input
              id="due_back_at"
              type="date"
              value={dueBackAt}
              onChange={(e) => setDueBackAt(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={checkoutMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {checkoutMutation.isPending ? 'Checking Out...' : 'Checkout'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}