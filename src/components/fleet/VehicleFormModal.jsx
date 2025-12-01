import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function VehicleFormModal({ open, onClose, vehicle }) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: "",
    registration_plate: "",
    internal_code: "",
    status: "Active",
    primary_location: "",
    assigned_user_id: "unassigned",
    notes: ""
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  useEffect(() => {
    if (open) {
      if (vehicle) {
        setFormData({
          name: vehicle.name || "",
          registration_plate: vehicle.registration_plate || "",
          internal_code: vehicle.internal_code || "",
          status: vehicle.status || "Active",
          primary_location: vehicle.primary_location || "",
          assigned_user_id: vehicle.assigned_user_id || "unassigned",
          notes: vehicle.notes || ""
        });
      } else {
        setFormData({
          name: "",
          registration_plate: "",
          internal_code: "",
          status: "Active",
          primary_location: "",
          assigned_user_id: "unassigned",
          notes: ""
        });
      }
    }
  }, [open, vehicle]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Handle assigned_user_name denormalization
      let assigned_user_name = null;
      if (data.assigned_user_id && data.assigned_user_id !== "unassigned") {
        const user = users.find(u => u.id === data.assigned_user_id);
        assigned_user_name = user ? (user.display_name || user.full_name) : null;
      }

      const payload = {
        ...data,
        assigned_user_id: data.assigned_user_id === "unassigned" ? null : data.assigned_user_id,
        assigned_user_name
      };

      if (vehicle) {
        return base44.entities.Vehicle.update(vehicle.id, payload);
      } else {
        return base44.entities.Vehicle.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      if (vehicle) {
        queryClient.invalidateQueries({ queryKey: ['vehicle', vehicle.id] });
      }
      toast.success(vehicle ? "Vehicle updated" : "Vehicle created");
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to save vehicle")
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Vehicle name is required");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Vehicle Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. KGD-01"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reg">Registration</Label>
              <Input
                id="reg"
                value={formData.registration_plate}
                onChange={(e) => setFormData({...formData, registration_plate: e.target.value})}
                placeholder="Plate No."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Internal Code</Label>
              <Input
                id="code"
                value={formData.internal_code}
                onChange={(e) => setFormData({...formData, internal_code: e.target.value})}
                placeholder="Code"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(val) => setFormData({...formData, status: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="In Maintenance">In Maintenance</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Primary Location</Label>
              <Input
                id="location"
                value={formData.primary_location}
                onChange={(e) => setFormData({...formData, primary_location: e.target.value})}
                placeholder="e.g. On Road"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned Technician</Label>
            <Select 
              value={formData.assigned_user_id} 
              onValueChange={(val) => setFormData({...formData, assigned_user_id: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional details..."
              className="h-20"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-black"
            >
              {mutation.isPending ? "Saving..." : (vehicle ? "Update Vehicle" : "Create Vehicle")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}