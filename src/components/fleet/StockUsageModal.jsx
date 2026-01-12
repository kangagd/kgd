import React, { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function StockUsageModal({ open, onClose, item, vehicleId }) {
  const [quantity, setQuantity] = useState(1);
  const [jobId, setJobId] = useState("");
  const queryClient = useQueryClient();

  const { data: myJobs = [] } = useQuery({
    queryKey: ['myActiveJobs'],
    queryFn: async () => {
      // Fetch active jobs for user
      const user = await base44.auth.me();
      const jobs = await base44.entities.Job.filter({ status: { $ne: 'Completed' } });
      // Filter client side if RLS allows reading all
      return jobs.filter(j => j.status !== 'Cancelled' && j.status !== 'Completed'); 
    },
    enabled: open
  });

  const consumeMutation = useMutation({
    mutationFn: async (data) => {
      // Get vehicle location first
      const locations = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicleId
      });
      const locationId = locations[0]?.id;

      if (!locationId) throw new Error('Vehicle location not found');

      const response = await base44.functions.invoke('moveInventory', {
        priceListItemId: item.product_id,
        fromLocationId: locationId,
        toLocationId: null,
        quantity: data.quantity,
        movementType: 'job_usage',
        jobId: data.job_id,
        notes: data.reason
      });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      toast.success("Marked as used");
      onClose();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = () => {
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    consumeMutation.mutate({
      quantity: parseInt(quantity),
      job_id: jobId && jobId !== 'none' ? jobId : null,
      reason: jobId && jobId !== 'none' ? `Used on Job` : "Used"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Used: {item?.product_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quantity Used</Label>
            <Input 
              type="number" 
              min="1"
              max={item?.quantity_on_hand}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <div className="text-xs text-gray-500">Available: {item?.quantity_on_hand}</div>
          </div>

          <div className="space-y-2">
            <Label>Job (Optional)</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / General Usage</SelectItem>
                {myJobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    #{job.job_number} - {job.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={consumeMutation.isPending}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-black"
          >
            {consumeMutation.isPending ? "Saving..." : "Confirm Usage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}