import { differenceInDays } from 'date-fns';

/**
 * Compute freshness status based on most recent meaningful action
 * Returns: { status: 'fresh'|'active'|'aging'|'stale', lastActionDate: Date|null, daysSinceAction: number }
 */
export function computeFreshness(entity, relatedData = {}) {
  const timestamps = [];
  
  // Entity updated_at (if user-updated, not just system sync)
  if (entity.updated_at) {
    timestamps.push(new Date(entity.updated_at));
  }
  
  // Related messages/emails
  if (relatedData.messages && Array.isArray(relatedData.messages)) {
    relatedData.messages.forEach(msg => {
      if (msg.created_at) timestamps.push(new Date(msg.created_at));
    });
  }
  
  if (relatedData.emails && Array.isArray(relatedData.emails)) {
    relatedData.emails.forEach(email => {
      if (email.created_at) timestamps.push(new Date(email.created_at));
    });
  }
  
  // Status changes (use updated_at if status was changed)
  if (entity.status_changed_at) {
    timestamps.push(new Date(entity.status_changed_at));
  }
  
  // Scheduled visits
  if (entity.scheduled_visits && Array.isArray(entity.scheduled_visits)) {
    entity.scheduled_visits.forEach(visit => {
      if (visit.date) timestamps.push(new Date(visit.date));
    });
  }
  
  if (entity.scheduled_date) {
    timestamps.push(new Date(entity.scheduled_date));
  }
  
  // Financial activity
  if (relatedData.invoices && Array.isArray(relatedData.invoices)) {
    relatedData.invoices.forEach(inv => {
      if (inv.created_at) timestamps.push(new Date(inv.created_at));
      if (inv.paid_date) timestamps.push(new Date(inv.paid_date));
    });
  }
  
  if (relatedData.quotes && Array.isArray(relatedData.quotes)) {
    relatedData.quotes.forEach(quote => {
      if (quote.created_at) timestamps.push(new Date(quote.created_at));
      if (quote.sent_at) timestamps.push(new Date(quote.sent_at));
    });
  }
  
  // Attention items
  if (relatedData.attentionItems && Array.isArray(relatedData.attentionItems)) {
    relatedData.attentionItems.forEach(item => {
      if (item.created_at || item.created_date) {
        timestamps.push(new Date(item.created_at || item.created_date));
      }
      if (item.resolved_at) timestamps.push(new Date(item.resolved_at));
    });
  }
  
  // Tasks
  if (relatedData.tasks && Array.isArray(relatedData.tasks)) {
    relatedData.tasks.forEach(task => {
      if (task.created_at || task.created_date) {
        timestamps.push(new Date(task.created_at || task.created_date));
      }
      if (task.updated_at) timestamps.push(new Date(task.updated_at));
    });
  }
  
  // Photo uploads
  if (relatedData.photos && Array.isArray(relatedData.photos)) {
    relatedData.photos.forEach(photo => {
      if (photo.uploaded_at) timestamps.push(new Date(photo.uploaded_at));
    });
  }
  
  // Check-in/out activity
  if (relatedData.checkIns && Array.isArray(relatedData.checkIns)) {
    relatedData.checkIns.forEach(checkIn => {
      if (checkIn.check_in_time) timestamps.push(new Date(checkIn.check_in_time));
      if (checkIn.check_out_time) timestamps.push(new Date(checkIn.check_out_time));
    });
  }
  
  // Job completion
  if (entity.completed_date) {
    timestamps.push(new Date(entity.completed_date));
  }
  
  // Fallback: created_at (only if no other actions)
  if (timestamps.length === 0 && (entity.created_at || entity.created_date)) {
    timestamps.push(new Date(entity.created_at || entity.created_date));
  }
  
  // Find most recent timestamp
  if (timestamps.length === 0) {
    return { status: 'stale', lastActionDate: null, daysSinceAction: null };
  }
  
  const mostRecent = timestamps.reduce((latest, current) => 
    current > latest ? current : latest
  );
  
  const daysSince = differenceInDays(new Date(), mostRecent);
  
  let status;
  if (daysSince <= 2) {
    status = 'fresh';
  } else if (daysSince <= 7) {
    status = 'active';
  } else if (daysSince <= 21) {
    status = 'aging';
  } else {
    status = 'stale';
  }
  
  return {
    status,
    lastActionDate: mostRecent,
    daysSinceAction: daysSince
  };
}

/**
 * Simplified freshness computation using only entity data
 * (when related data is not available)
 */
export function computeSimpleFreshness(entity) {
  return computeFreshness(entity, {});
}