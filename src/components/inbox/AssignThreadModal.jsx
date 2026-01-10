import React, { useState, useEffect } from "react";
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
import { UserCheck, UserX } from "lucide-react";

export default function AssignThreadModal({ thread, open, onClose }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [note, setNote] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => {
      const result = await base44.functions.invoke('getTeamMembers', {});
      return result.data?.users || [];
    },
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

  const handleUnassign = async () => {
    try {
      await base44.entities.EmailThread.update(thread.id, {
        assigned_to: null,
        assigned_to_name: null,
        status: 'Open'
      });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      toast.success('Thread unassigned');
      onClose();
    } catch (error) {
      toast.error('Failed to unassign thread');
    }
  };

  const handleAssignToMe = () => {
    if (currentUser) {
      setSelectedUser(currentUser.email);
    }
  };

  // Filter active users
  const activeUsers = users.filter(u => u.email);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Email Thread</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {thread.assigned_to && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Currently assigned to: <strong>{thread.assigned_to_name}</strong>
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleAssignToMe}
              className="flex-1"
              disabled={selectedUser === currentUser?.email}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Assign to Me
            </Button>
            {thread.assigned_to && (
              <Button 
                type="button"
                variant="outline" 
                onClick={handleUnassign}
                disabled={assignMutation.isPending}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <UserX className="w-4 h-4 mr-2" />
                Unassign
              </Button>
            )}
          </div>

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