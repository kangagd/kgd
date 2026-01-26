import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getBookingTypeLabel, findOverlaps, normalizeJobToEvent, normalizeBookingToEvent } from "@/components/utils/calendarEventHelpers";
import { bookingKeys } from "@/components/api/queryKeys";
import { Loader2, AlertTriangle } from "lucide-react";
import GlobalProjectSearch from "@/components/common/GlobalProjectSearch";
import GlobalContractSearch from "@/components/common/GlobalContractSearch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function BookingEditor({ open, onClose, booking, defaultDate, defaultUsers, allJobs, allBookings }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "meeting",
    start_at: "",
    end_at: "",
    assigned_user_ids: [],
    location: "",
    notes: "",
    related_project_id: "",
    related_contract_id: "",
    is_all_day: false,
  });
  const [overlapWarning, setOverlapWarning] = useState(null);
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => u.is_field_technician === true);
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => base44.entities.Contract.list(),
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (booking) {
      setFormData({
        title: booking.title || "",
        type: booking.type || "meeting",
        start_at: booking.start_at ? format(new Date(booking.start_at), "yyyy-MM-dd'T'HH:mm") : "",
        end_at: booking.end_at ? format(new Date(booking.end_at), "yyyy-MM-dd'T'HH:mm") : "",
        assigned_user_ids: booking.assigned_user_ids || [],
        location: booking.location || "",
        notes: booking.notes || "",
        related_project_id: booking.related_project_id || "",
        related_contract_id: booking.related_contract_id || "",
        is_all_day: booking.is_all_day || false,
      });
    } else {
      // New booking defaults
      const defaultStart = defaultDate ? format(new Date(defaultDate), "yyyy-MM-dd'T'09:00") : "";
      const defaultEnd = defaultDate ? format(new Date(defaultDate), "yyyy-MM-dd'T'10:00") : "";
      
      setFormData({
        title: "",
        type: "meeting",
        start_at: defaultStart,
        end_at: defaultEnd,
        assigned_user_ids: defaultUsers || (user ? [user.id] : []),
        location: "",
        notes: "",
        related_project_id: "",
        related_contract_id: "",
        is_all_day: false,
      });
    }
  }, [booking, defaultDate, defaultUsers, user]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Get user details for caching
      const assignedUsers = technicians.filter(t => data.assigned_user_ids.includes(t.id));
      
      return base44.entities.CalendarBooking.create({
        ...data,
        assigned_user_emails: assignedUsers.map(u => u.email),
        assigned_user_names: assignedUsers.map(u => u.display_name || u.full_name),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking created");
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to create booking: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const assignedUsers = technicians.filter(t => data.assigned_user_ids.includes(t.id));
      
      return base44.entities.CalendarBooking.update(booking.id, {
        ...data,
        assigned_user_emails: assignedUsers.map(u => u.email),
        assigned_user_names: assignedUsers.map(u => u.display_name || u.full_name),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking updated");
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to update booking: " + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.start_at || !formData.end_at) {
      toast.error("Start and end times are required");
      return;
    }
    if (new Date(formData.end_at) <= new Date(formData.start_at)) {
      toast.error("End time must be after start time");
      return;
    }
    if (!formData.assigned_user_ids || formData.assigned_user_ids.length === 0) {
      toast.error("At least one user must be assigned");
      return;
    }

    // Check for overlaps
    const normalizedBooking = {
      id: booking?.id,
      start_at: new Date(formData.start_at),
      end_at: new Date(formData.end_at),
      assigned_user_ids: formData.assigned_user_ids,
    };

    const allEvents = [
      ...(allJobs || []).map(normalizeJobToEvent),
      ...(allBookings || []).filter(b => b.status !== 'cancelled').map(normalizeBookingToEvent),
    ];

    const overlaps = findOverlaps(normalizedBooking, allEvents);

    if (overlaps.length > 0) {
      setOverlapWarning(overlaps);
      setShowOverlapDialog(true);
      return;
    }

    // No overlaps, proceed
    proceedWithSave();
  };

  const proceedWithSave = () => {
    setShowOverlapDialog(false);
    if (booking) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{booking ? "Edit Booking" : "New Booking"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Team Meeting"
                required
              />
            </div>

            <div>
              <Label>Type *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">{getBookingTypeLabel("meeting")}</SelectItem>
                  <SelectItem value="car_cleaning">{getBookingTypeLabel("car_cleaning")}</SelectItem>
                  <SelectItem value="warehouse">{getBookingTypeLabel("warehouse")}</SelectItem>
                  <SelectItem value="pickup">{getBookingTypeLabel("pickup")}</SelectItem>
                  <SelectItem value="training">{getBookingTypeLabel("training")}</SelectItem>
                  <SelectItem value="admin_block">{getBookingTypeLabel("admin_block")}</SelectItem>
                  <SelectItem value="other">{getBookingTypeLabel("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start *</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>End *</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_at}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Assign to * (select one or more)</Label>
              {formData.assigned_user_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {formData.assigned_user_ids.map(userId => {
                    const tech = technicians.find(t => t.id === userId);
                    if (!tech) return null;
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {tech.display_name || tech.full_name}
                        <button
                          type="button"
                          onClick={() => setFormData({ 
                            ...formData, 
                            assigned_user_ids: formData.assigned_user_ids.filter(id => id !== userId) 
                          })}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {technicians.map((tech) => (
                  <label key={tech.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <Checkbox
                      checked={formData.assigned_user_ids.includes(tech.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ 
                            ...formData, 
                            assigned_user_ids: [...formData.assigned_user_ids, tech.id] 
                          });
                        } else {
                          setFormData({ 
                            ...formData, 
                            assigned_user_ids: formData.assigned_user_ids.filter(id => id !== tech.id) 
                          });
                        }
                      }}
                    />
                    <span className="text-sm">{tech.display_name || tech.full_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Office, Warehouse"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Link to Project (optional)</Label>
                <GlobalProjectSearch
                  projects={projects}
                  value={formData.related_project_id}
                  onChange={(project) => setFormData({ ...formData, related_project_id: project?.id || "" })}
                  placeholder="Search projects..."
                />
                {formData.related_project_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, related_project_id: "" })}
                    className="mt-1"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div>
                <Label>Link to Contract (optional)</Label>
                <GlobalContractSearch
                  contracts={contracts}
                  value={formData.related_contract_id}
                  onChange={(contract) => setFormData({ ...formData, related_contract_id: contract?.id || "" })}
                  placeholder="Search contracts..."
                />
                {formData.related_contract_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, related_contract_id: "" })}
                    className="mt-1"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {booking ? "Update" : "Create"} Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overlap Warning Dialog */}
      <AlertDialog open={showOverlapDialog} onOpenChange={setShowOverlapDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Scheduling Conflict
            </AlertDialogTitle>
            <AlertDialogDescription>
              This booking overlaps with {overlapWarning?.length} existing item(s):
              <ul className="mt-2 space-y-1 text-sm">
                {overlapWarning?.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="text-[#111827]">
                    • {item.source === "job" ? `Job: ${item.title}` : `Booking: ${item.title}`}
                  </li>
                ))}
                {overlapWarning?.length > 3 && (
                  <li className="text-[#6B7280]">...and {overlapWarning.length - 3} more</li>
                )}
              </ul>
              <p className="mt-3">Do you want to save this booking anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSave}>Save Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}