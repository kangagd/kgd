import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

export default function CreateSampleModal({ open, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sample_tag: '',
    home_location_type: 'warehouse',
    home_location_reference_id: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('manageSample', {
        action: 'createSample',
        data: formData,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success('Sample created successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to create sample: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Sample name is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Sample</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Sample Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., 36mm Roller Shutter (CW)"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Roller Shutter"
            />
          </div>

          <div>
            <Label htmlFor="sample_tag">Sample Tag (Barcode/QR)</Label>
            <Input
              id="sample_tag"
              value={formData.sample_tag}
              onChange={(e) => setFormData({ ...formData, sample_tag: e.target.value })}
              placeholder="e.g., CW-36"
            />
          </div>

          <div>
            <Label htmlFor="home_location_type">Home Location</Label>
            <Select 
              value={formData.home_location_type} 
              onValueChange={(value) => setFormData({ 
                ...formData, 
                home_location_type: value,
                home_location_reference_id: value === 'warehouse' ? '' : formData.home_location_reference_id
              })}
            >
              <SelectTrigger id="home_location_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.home_location_type === 'vehicle' && (
            <div>
              <Label htmlFor="home_vehicle">Home Vehicle</Label>
              <Select 
                value={formData.home_location_reference_id} 
                onValueChange={(value) => setFormData({ ...formData, home_location_reference_id: value })}
              >
                <SelectTrigger id="home_vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name || v.registration_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              disabled={createMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Sample'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}