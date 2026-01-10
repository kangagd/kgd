import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { User } from 'lucide-react';

export default function TechnicianAssignmentModal({ open, onClose, vehicle, technicians = [] }) {
  const queryClient = useQueryClient();
  const [selectedTechEmail, setSelectedTechEmail] = useState(vehicle?.assigned_technician_email || '');

  const assignMutation = useMutation({
    mutationFn: async (techEmail) => {
      const response = await base44.functions.invoke('initializeWarehouseLocations', {
        action: 'assign_technician',
        location_id: vehicle.id,
        technician_email: techEmail
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryLocations'] });
      toast.success('Technician assigned');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to assign: ${error.message}`);
    }
  });

  const handleAssign = () => {
    if (!selectedTechEmail) {
      toast.error('Please select a technician');
      return;
    }
    assignMutation.mutate(selectedTechEmail);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#111827]" />
            Assign Technician to {vehicle?.name}
          </DialogTitle>
          <DialogDescription>
            Select a technician to assign to this vehicle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Select value={selectedTechEmail} onValueChange={setSelectedTechEmail}>
            <SelectTrigger>
              <SelectValue placeholder="Select technician..." />
            </SelectTrigger>
            <SelectContent>
              {technicians.map((tech) => (
                <SelectItem key={tech.email} value={tech.email}>
                  {tech.display_name || tech.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {vehicle?.assigned_technician_name && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-[12px] text-blue-700">
                <strong>Currently assigned:</strong> {vehicle.assigned_technician_name}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}