import { parseISO, isAfter, isBefore } from "date-fns";

/**
 * Normalize Jobs and Bookings into a unified calendar event shape
 */
export function normalizeJobToEvent(job) {
  const scheduledDate = job.scheduled_date ? new Date(job.scheduled_date) : null;
  const scheduledTime = job.scheduled_time || "00:00";
  const [hours, minutes] = scheduledTime.split(":");
  
  let startAt = null;
  let endAt = null;
  
  if (scheduledDate) {
    startAt = new Date(scheduledDate);
    startAt.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    
    endAt = new Date(startAt);
    if (job.expected_duration) {
      endAt.setHours(startAt.getHours() + job.expected_duration);
    } else {
      endAt.setHours(startAt.getHours() + 2); // Default 2 hours
    }
  }

  return {
    id: job.id,
    source: "job",
    title: job.customer_name || "Untitled Job",
    start_at: startAt,
    end_at: endAt,
    assigned_user_ids: job.assigned_to || [],
    assigned_user_emails: job.assigned_to || [],
    status: job.status,
    location: job.address,
    colorHint: "job",
    original: job,
  };
}

export function normalizeBookingToEvent(booking) {
  return {
    id: booking.id,
    source: "booking",
    title: booking.title,
    start_at: booking.start_at ? new Date(booking.start_at) : null,
    end_at: booking.end_at ? new Date(booking.end_at) : null,
    assigned_user_ids: booking.assigned_user_ids || [],
    assigned_user_emails: booking.assigned_user_emails || [],
    status: booking.status,
    location: booking.location,
    colorHint: booking.type,
    original: booking,
  };
}

/**
 * Check if two time ranges overlap
 */
export function checkTimeOverlap(start1, end1, start2, end2) {
  const s1 = start1 instanceof Date ? start1 : new Date(start1);
  const e1 = end1 instanceof Date ? end1 : new Date(end1);
  const s2 = start2 instanceof Date ? start2 : new Date(start2);
  const e2 = end2 instanceof Date ? end2 : new Date(end2);
  
  return s1 < e2 && e1 > s2;
}

/**
 * Find overlapping events for a given booking
 */
export function findOverlaps(newBooking, existingEvents) {
  const overlaps = [];
  
  for (const event of existingEvents) {
    // Skip cancelled events
    if (event.status === "cancelled") continue;
    
    // Skip the same event (when editing)
    if (event.source === "booking" && event.id === newBooking.id) continue;
    
    // Check if assigned users overlap
    const usersOverlap = newBooking.assigned_user_ids?.some(userId =>
      event.assigned_user_emails?.includes(userId) || event.assigned_user_ids?.includes(userId)
    );
    
    if (!usersOverlap) continue;
    
    // Check time overlap
    if (checkTimeOverlap(newBooking.start_at, newBooking.end_at, event.start_at, event.end_at)) {
      overlaps.push(event);
    }
  }
  
  return overlaps;
}

/**
 * Get booking type label
 */
export function getBookingTypeLabel(type) {
  const labels = {
    meeting: "Meeting",
    car_cleaning: "Car Cleaning",
    warehouse: "Warehouse",
    pickup: "Pickup",
    training: "Training",
    admin_block: "Admin Block",
    other: "Other",
  };
  return labels[type] || type;
}

/**
 * Get booking type color
 */
export function getBookingTypeColor(type) {
  const colors = {
    meeting: "bg-blue-100 text-blue-800",
    car_cleaning: "bg-green-100 text-green-800",
    warehouse: "bg-purple-100 text-purple-800",
    pickup: "bg-orange-100 text-orange-800",
    training: "bg-indigo-100 text-indigo-800",
    admin_block: "bg-gray-100 text-gray-800",
    other: "bg-slate-100 text-slate-800",
  };
  return colors[type] || colors.other;
}