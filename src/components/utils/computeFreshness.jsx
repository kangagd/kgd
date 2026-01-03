import { differenceInHours } from "date-fns";

/**
 * Compute freshness status based on most recent meaningful action
 * Returns: { status: 'fresh'|'active'|'aging'|'stale', lastActionDate: Date|null, daysSinceAction: number|null }
 */
/**
 * CRITICAL: Freshness computation for projects/jobs/entities
 * DO NOT MODIFY without testing across all entity types
 * 
 * Thresholds:
 * - Fresh: ≤ 48 hours (2 days)
 * - Active: ≤ 168 hours (7 days)
 * - Aging: ≤ 504 hours (21 days)
 * - Stale: > 504 hours
 */
export function computeFreshness(entity) {
  let mostRecent = null;

  // CRITICAL: Timestamp parser - DO NOT MODIFY without testing all date formats
  // This handles: ISO strings, UTC strings, timestamps (ms/s), Date objects
  const parseTs = (ts) => {
    if (!ts) return null;

    // String timestamps (most common)
    if (typeof ts === "string") {
      const s = ts.trim();
      // Try parsing directly first (handles most ISO formats correctly)
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d;
      }
      // Fallback: if no timezone and parse failed, assume UTC
      if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
        const dWithZ = new Date(`${s}Z`);
        if (!isNaN(dWithZ.getTime())) return dWithZ;
      }
      return null;
    }

    // Numeric timestamps
    if (typeof ts === "number") {
      const ms = ts < 1e12 ? ts * 1000 : ts; // seconds vs milliseconds
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // Date objects
    if (ts instanceof Date) {
      return isNaN(ts.getTime()) ? null : ts;
    }

    // Firestore-style timestamps
    if (typeof ts === "object" && typeof ts.seconds === "number") {
      const d = new Date(ts.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  };

  // CRITICAL: Freshness priority order - DO NOT CHANGE without understanding impact
  // Priority: last_activity_at > last_customer_message_at > updated_at > created_at
  // This determines what makes a project "fresh" vs "stale"
  mostRecent =
    parseTs(entity.last_activity_at) ||
    parseTs(entity.last_customer_message_at) ||
    parseTs(entity.updated_at) ||
    parseTs(entity.created_at || entity.created_date);

  if (!mostRecent) {
    return { status: "stale", lastActionDate: null, daysSinceAction: null };
  }

  const hoursSinceRaw = differenceInHours(new Date(), mostRecent);
  const hoursSince = Math.max(0, hoursSinceRaw);
  const daysSince = Math.floor(hoursSince / 24);

  // CRITICAL: Freshness thresholds - DO NOT CHANGE without product approval
  let status;
  if (hoursSince <= 48) status = "fresh";        // 0-2 days
  else if (hoursSince <= 168) status = "active"; // 2-7 days
  else if (hoursSince <= 504) status = "aging";  // 7-21 days
  else status = "stale";                          // 21+ days

  return { status, lastActionDate: mostRecent, daysSinceAction: daysSince };
}

/**
 * Simplified freshness computation using only entity data
 * (when related data is not available)
 */
export function computeSimpleFreshness(entity) {
  return computeFreshness(entity);
}