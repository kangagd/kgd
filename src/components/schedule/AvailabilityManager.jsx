import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { Calendar, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

export default function AvailabilityManager({ open, onClose, technicians = [] }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("leave");

  // --- Technician Leave State ---
  const [leaveTech, setLeaveTech] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("unavailable");

  // --- Closed Days State ---
  const [closedName, setClosedName] = useState("");
  const [closedStart, setClosedStart] = useState("");
  const [closedEnd, setClosedEnd] = useState("");

  // --- Queries ---
  const { data: leaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['technicianLeaves'],
    queryFn: () => base44.entities.TechnicianLeave.list('-start_time'),
    enabled: open,
    refetchOnMount: true,
    staleTime: 0
  });

  const { data: closedDays = [], isLoading: closedDaysLoading } = useQuery({
    queryKey: ['businessClosedDays'],
    queryFn: () => base44.entities.BusinessClosedDay.list('-start_time'),
    enabled: open,
    refetchOnMount: true,
    staleTime: 0
  });

  // --- Mutations ---
  const createLeaveMutation = useMutation({
    mutationFn: (data) => base44.entities.TechnicianLeave.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['scheduleConflicts'] }); // If we add this query key later
      toast.success("Leave added");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
    }
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: (id) => base44.entities.TechnicianLeave.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianLeaves'] });
      toast.success("Leave removed");
    }
  });

  const createClosedDayMutation = useMutation({
    mutationFn: (data) => base44.entities.BusinessClosedDay.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessClosedDays'] });
      toast.success("Closed period added");
      setClosedName("");
      setClosedStart("");
      setClosedEnd("");
    }
  });

  const deleteClosedDayMutation = useMutation({
    mutationFn: (id) => base44.entities.BusinessClosedDay.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessClosedDays'] });
      toast.success("Closed period removed");
    }
  });

  // --- Handlers ---
  const handleAddLeave = (e) => {
    e.preventDefault();
    if (!leaveTech || !leaveStart || !leaveEnd) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    const tech = technicians.find(t => t.email === leaveTech);
    
    // Create start and end times at beginning and end of days
    const startDate = new Date(leaveStart);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(leaveEnd);
    endDate.setHours(23, 59, 59, 999);
    
    createLeaveMutation.mutate({
      technician_email: leaveTech,
      technician_name: tech ? (tech.full_name || tech.display_name) : leaveTech,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      reason: leaveReason,
      leave_type: leaveType
    });
  };

  const handleAddClosedDay = (e) => {
    e.preventDefault();
    if (!closedName || !closedStart || !closedEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Create start and end times at beginning and end of days
    const startDate = new Date(closedStart);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(closedEnd);
    endDate.setHours(23, 59, 59, 999);
    
    createClosedDayMutation.mutate({
      name: closedName,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      is_full_day: true
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Availability</DialogTitle>
          <DialogDescription>
            Manage technician leave and business closed days.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leave">Technician Leave</TabsTrigger>
            <TabsTrigger value="closed">Business Closed Days</TabsTrigger>
          </TabsList>

          {/* --- Technician Leave Tab --- */}
          <TabsContent value="leave" className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-medium text-sm text-gray-700">Add New Leave</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Technician</Label>
                  <Select value={leaveTech} onValueChange={setLeaveTech}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map(tech => (
                        <SelectItem key={tech.email} value={tech.email}>
                          {tech.full_name || tech.display_name || tech.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Leave Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={leaveStart} 
                    onChange={e => setLeaveStart(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={leaveEnd} 
                    onChange={e => setLeaveEnd(e.target.value)} 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Reason (Optional)</Label>
                  <Input 
                    value={leaveReason} 
                    onChange={e => setLeaveReason(e.target.value)} 
                    placeholder="e.g. Doctor's appointment"
                  />
                </div>
              </div>
              <Button onClick={handleAddLeave} disabled={createLeaveMutation.isPending}>
                {createLeaveMutation.isPending ? "Adding..." : "Add Leave"}
              </Button>
            </div>

            <div className="border rounded-lg">
              <div className="p-3 bg-gray-50 border-b font-medium text-sm text-gray-700">
                Upcoming Leave
              </div>
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {leavesLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : leaves.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No leave records found.</div>
                ) : (
                  leaves.map(leave => (
                    <div key={leave.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-sm">{leave.technician_name || leave.technician_email}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className="capitalize px-1.5 py-0.5 bg-gray-100 rounded">{leave.leave_type}</span>
                          <span>
                            {format(parseISO(leave.start_time), "MMM d, yyyy")} - {format(parseISO(leave.end_time), "MMM d, yyyy")}
                          </span>
                        </div>
                        {leave.reason && <div className="text-xs text-gray-600 mt-1">{leave.reason}</div>}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm('Delete this leave record?')) deleteLeaveMutation.mutate(leave.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* --- Closed Days Tab --- */}
          <TabsContent value="closed" className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-medium text-sm text-gray-700">Add Closed Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Name / Reason</Label>
                  <Input 
                    value={closedName} 
                    onChange={e => setClosedName(e.target.value)} 
                    placeholder="e.g. Christmas Holiday"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={closedStart} 
                    onChange={e => setClosedStart(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={closedEnd} 
                    onChange={e => setClosedEnd(e.target.value)} 
                  />
                </div>
              </div>
              <Button onClick={handleAddClosedDay} disabled={createClosedDayMutation.isPending}>
                {createClosedDayMutation.isPending ? "Adding..." : "Add Closed Period"}
              </Button>
            </div>

            <div className="border rounded-lg">
              <div className="p-3 bg-gray-50 border-b font-medium text-sm text-gray-700">
                Closed Days & Holidays
              </div>
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {closedDaysLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : closedDays.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No closed days recorded.</div>
                ) : (
                  closedDays.map(day => (
                    <div key={day.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-sm">{day.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(parseISO(day.start_time), "MMM d, yyyy")} - {format(parseISO(day.end_time), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm('Delete this closed period?')) deleteClosedDayMutation.mutate(day.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}