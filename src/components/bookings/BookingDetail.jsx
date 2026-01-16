import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, MapPin, FileText, Trash2, Edit, CheckCircle2, X } from "lucide-react";
import { getBookingTypeLabel, getBookingTypeColor } from "@/components/utils/calendarEventHelpers";
import BookingEditor from "./BookingEditor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EntityLink from "@/components/common/EntityLink";

export default function BookingDetail({ open, onClose, booking, allJobs, allBookings }) {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () => base44.entities.CalendarBooking.update(booking.id, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to cancel booking: " + error.message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => base44.entities.CalendarBooking.update(booking.id, { status: "completed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking marked as completed");
    },
    onError: (error) => {
      toast.error("Failed to update booking: " + error.message);
    },
  });

  if (!booking) return null;

  return (
    <>
      <Drawer open={open && !showEditor} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-[#E5E7EB]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-xl mb-2">{booking.title}</DrawerTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getBookingTypeColor(booking.type)}>
                    {getBookingTypeLabel(booking.type)}
                  </Badge>
                  <Badge variant={booking.status === "scheduled" ? "default" : booking.status === "completed" ? "secondary" : "outline"}>
                    {booking.status}
                  </Badge>
                </div>
              </div>
            </div>
          </DrawerHeader>

          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#6B7280] mt-0.5" />
                <div>
                  <div className="font-medium text-[#111827]">
                    {format(new Date(booking.start_at), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="text-sm text-[#6B7280]">
                    {format(new Date(booking.start_at), "h:mm a")} - {format(new Date(booking.end_at), "h:mm a")}
                  </div>
                </div>
              </div>

              {booking.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#6B7280] mt-0.5" />
                  <div className="text-sm text-[#111827]">{booking.location}</div>
                </div>
              )}

              {booking.assigned_user_names && booking.assigned_user_names.length > 0 && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#6B7280] mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-[#111827]">Assigned to:</div>
                    <div className="text-sm text-[#6B7280]">
                      {booking.assigned_user_names.join(", ")}
                    </div>
                  </div>
                </div>
              )}

              {booking.notes && (
                <div className="bg-[#F9FAFB] rounded-lg p-4 border border-[#E5E7EB]">
                  <div className="text-sm font-medium text-[#111827] mb-1">Notes</div>
                  <div className="text-sm text-[#6B7280] whitespace-pre-wrap">{booking.notes}</div>
                </div>
              )}

              {(booking.related_project_id || booking.related_contract_id) && (
                <div className="bg-[#F9FAFB] rounded-lg p-4 border border-[#E5E7EB]">
                  <div className="text-sm font-medium text-[#111827] mb-2">Related Items</div>
                  <div className="space-y-1">
                    {booking.related_project_id && (
                      <EntityLink entity="project" id={booking.related_project_id}>
                        <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-blue-600 hover:text-blue-700">
                          View Project
                        </Button>
                      </EntityLink>
                    )}
                    {booking.related_contract_id && (
                      <EntityLink entity="contract" id={booking.related_contract_id}>
                        <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-blue-600 hover:text-blue-700">
                          View Contract
                        </Button>
                      </EntityLink>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#E5E7EB] p-4 flex gap-2 flex-wrap">
            {booking.status === "scheduled" && (
              <>
                <Button onClick={() => setShowEditor(true)} variant="outline" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button onClick={() => completeMutation.mutate()} variant="outline" className="flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
                <Button onClick={() => setShowCancelDialog(true)} variant="outline" className="flex-1 text-red-600 hover:text-red-700">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
            {booking.status === "completed" && (
              <Button onClick={() => setShowEditor(true)} variant="outline" className="flex-1">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {showEditor && (
        <BookingEditor
          open={showEditor}
          onClose={() => {
            setShowEditor(false);
            onClose();
          }}
          booking={booking}
          allJobs={allJobs}
          allBookings={allBookings}
        />
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()}>
              Yes, cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}