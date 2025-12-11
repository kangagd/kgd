import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SAMPLE_STATUS, SAMPLE_LOCATION_TYPE } from "../domain/sampleConfig";
import { toast } from "sonner";

export default function CreateSampleModal({ open, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sample_tag: "",
    status: SAMPLE_STATUS.ACTIVE,
    location_type: SAMPLE_LOCATION_TYPE.WAREHOUSE,
    location_reference_id: null,
    home_location_type: SAMPLE_LOCATION_TYPE.WAREHOUSE,
    home_location_reference_id: null,
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Sample.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success("Sample created successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to create sample: ${error.message}`);
    },
  });

  const handleClose = () => {
    setFormData({
      name: "",
      category: "",
      sample_tag: "",
      status: SAMPLE_STATUS.ACTIVE,
      location_type: SAMPLE_LOCATION_TYPE.WAREHOUSE,
      location_reference_id: null,
      home_location_type: SAMPLE_LOCATION_TYPE.WAREHOUSE,
      home_location_reference_id: null,
      notes: "",
    });
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Sample name is required");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Sample</DialogTitle>
          <DialogDescription>
            Add a new physical sample to the library
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Sample Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Rollmatic Insulated Panel – White"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Garage Door Panel, Colour Swatch"
            />
          </div>

          <div>
            <Label htmlFor="sample_tag">Sample Tag</Label>
            <Input
              id="sample_tag"
              value={formData.sample_tag}
              onChange={(e) => setFormData({ ...formData, sample_tag: e.target.value })}
              placeholder="e.g., QR code or barcode"
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAMPLE_STATUS.ACTIVE}>Active</SelectItem>
                <SelectItem value={SAMPLE_STATUS.MISSING}>Missing</SelectItem>
                <SelectItem value={SAMPLE_STATUS.RETIRED}>Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="home_location_type">Home Location</Label>
            <Select
              value={formData.home_location_type}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                home_location_type: value,
                home_location_reference_id: null 
              })}
            >
              <SelectTrigger id="home_location_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAMPLE_LOCATION_TYPE.WAREHOUSE}>Warehouse</SelectItem>
                <SelectItem value={SAMPLE_LOCATION_TYPE.VEHICLE}>Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.home_location_type === SAMPLE_LOCATION_TYPE.VEHICLE && (
            <div>
              <Label htmlFor="home_vehicle">Home Vehicle</Label>
              <Select
                value={formData.home_location_reference_id || ""}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  home_location_reference_id: value 
                })}
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
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {createMutation.isPending ? "Creating..." : "Create Sample"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}