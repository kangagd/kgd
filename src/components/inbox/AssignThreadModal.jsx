import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

export default function AssignThreadModal({ thread, open, onClose }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('assignEmailThread', {
        thread_id: thread.id,
        assigned_to_email: selectedUser,
        note: note
      });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      queryClient.invalidateQueries({ queryKey: ['emailThread', thread.id] });
      toast.success(`Thread assigned to ${data.assigned_to_name}`);
      onClose();
      setSelectedUser("");
      setNote("");
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign thread');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error('Please select a team member');
      return;
    }
    assignMutation.mutate();
  };

  // Filter active users
  const activeUsers = users.filter(u => u.email);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Thread to Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="user">Assign To</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.email} value={user.email}>
                    {user.display_name || user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="note">Internal Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note visible only to team members..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}