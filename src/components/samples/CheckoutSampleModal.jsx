import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CheckoutSampleModal({ sample, open, onClose }) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [dueBackAt, setDueBackAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.functions.invoke('manageSample', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sampleMovements'] });
      toast.success('Sample checked out successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to checkout sample');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectId) {
      toast.error('Please select a project');
      return;
    }
    
    checkoutMutation.mutate({
      action: 'checkoutToProject',
      sample_id: sample.id,
      project_id: projectId,
      due_back_at: dueBackAt || undefined,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Checkout Sample to Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Sample</Label>
            <Input value={sample.name} disabled className="bg-[#F9FAFB]" />
          </div>

          <div>
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Back Date</Label>
            <Input
              type="date"
              value={dueBackAt}
              onChange={(e) => setDueBackAt(e.target.value)}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={checkoutMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {checkoutMutation.isPending ? 'Checking out...' : 'Checkout'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}