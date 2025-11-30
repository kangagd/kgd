import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function VehicleFormModal({ open, onClose, vehicle }) {
  const [formData, setFormData] = useState({
    name: "",
    registration_plate: "",
    status: "Active",
    assigned_user_id: "",
    assigned_user_name: "",
    primary_location: "",
    notes: ""
  });
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  useEffect(() => {
    if (vehicle) {
      setFormData(vehicle);
    } else {
      setFormData({
        name: "",
        registration_plate: "",
        status: "Active",
        assigned_user_id: "",
        assigned_user_name: "",
        primary_location: "",
        notes: ""
      });
    }
  }, [vehicle, open]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (vehicle) {
        return base44.entities.Vehicle.update(vehicle.id, data);
      } else {
        return base44.entities.Vehicle.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(vehicle ? "Vehicle updated" : "Vehicle created");
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleUserChange = (userId) => {
    const user = users.find(u => u.id === userId);
    setFormData({
      ...formData,
      assigned_user_id: userId,
      assigned_user_name: user ? user.full_name : ""
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Name</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. Van 1" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Registration Plate</Label>
            <Input 
              value={formData.registration_plate} 
              onChange={(e) => setFormData({...formData, registration_plate: e.target.value})} 
              placeholder="e.g. ABC-123" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Assigned Driver</Label>
            <Select value={formData.assigned_user_id || "unassigned"} onValueChange={(val) => handleUserChange(val === "unassigned" ? null : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
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
            <Label>Primary Location</Label>
            <Input 
              value={formData.primary_location} 
              onChange={(e) => setFormData({...formData, primary_location: e.target.value})} 
              placeholder="e.g. Sydney Depot" 
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}