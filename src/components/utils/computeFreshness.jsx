import { differenceInHours } from "date-fns";

/**
 * Compute freshness status based on most recent meaningful action
 * Returns: { status: 'fresh'|'active'|'aging'|'stale', lastActionDate: Date|null, daysSinceAction: number|null }
 */
export function computeFreshness(entity, relatedData = {}) {
  let mostRecent = null;

  const parseTs = (ts) => {
    if (!ts) return null;

    if (typeof ts === "string") {
      const s = ts.trim();
      // If timezone info exists (Z or +hh:mm / -hh:mm), parse directly
      if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      }
      // If no timezone, assume UTC
      const d = new Date(`${s}Z`);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof ts === "number") {
      const ms = ts < 1e12 ? ts * 1000 : ts; // seconds vs millis
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    if (ts instanceof Date) {
      return isNaN(ts.getTime()) ? null : ts;
    }

    if (typeof ts === "object" && typeof ts.seconds === "number") {
      const d = new Date(ts.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  };

  mostRecent =
    parseTs(entity.last_activity_at) ||
    parseTs(entity.updated_at) ||
    parseTs(entity.created_at || entity.created_date);

  if (!mostRecent) {
    return { status: "stale", lastActionDate: null, daysSinceAction: null };
  }

  const hoursSinceRaw = differenceInHours(new Date(), mostRecent);
  const hoursSince = Math.max(0, hoursSinceRaw);
  const daysSince = Math.floor(hoursSince / 24);

  let status;
  if (hoursSince <= 48) status = "fresh";
  else if (hoursSince <= 168) status = "active";
  else if (hoursSince <= 504) status = "aging";
  else status = "stale";

  return { status, lastActionDate: mostRecent, daysSinceAction: daysSince };
}

/**
 * Simplified freshness computation using only entity data
 * (when related data is not available)
 */
export function computeSimpleFreshness(entity) {
  return computeFreshness(entity, {});
}