import { differenceInDays } from 'date-fns';

/**
 * Compute freshness status based on most recent meaningful action
 * Returns: { status: 'fresh'|'active'|'aging'|'stale', lastActionDate: Date|null, daysSinceAction: number }
 */
export function computeFreshness(entity, relatedData = {}) {
  let mostRecent = null;
  
  // Priority 1: last_activity_at (tracked by system for all meaningful actions)
  if (entity.last_activity_at) {
    mostRecent = new Date(entity.last_activity_at);
  }
  // Priority 2: updated_at
  else if (entity.updated_at) {
    mostRecent = new Date(entity.updated_at);
  }
  // Priority 3: created_at/created_date
  else if (entity.created_at || entity.created_date) {
    mostRecent = new Date(entity.created_at || entity.created_date);
  }
  
  if (!mostRecent) {
    return { status: 'stale', lastActionDate: null, daysSinceAction: null };
  }
  
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