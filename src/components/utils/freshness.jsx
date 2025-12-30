import { computeFreshness } from "./computeFreshness";
import { differenceInDays } from "date-fns";

/**
 * Get the effective opened date for a project
 * @param {Object} project - Project object
 * @returns {string|null} - ISO date string
 */
export function getProjectEffectiveOpenedDate(project) {
  return project?.opened_date || project?.created_date || null;
}

/**
 * Calculate project age based on opened_date or created_date
 * @param {Object} project - Project object
 * @returns {number|null} - Age in days
 */
export function getProjectAge(project) {
  const openedDate = project?.opened_date || project?.created_date;
  if (!openedDate) return null;
  
  try {
    const date = new Date(openedDate);
    if (isNaN(date.getTime())) return null;
    return Math.max(0, differenceInDays(new Date(), date));
  } catch {
    return null;
  }
}

/**
 * Calculate project freshness based on last activity
 * @param {Object} project - Project object
 * @returns {Object} { label: string, color: string, days: number }
 */
export function getProjectFreshnessBadge(project) {
  const { status, daysSinceAction } = computeFreshness(project);
  
  const statusMap = {
    fresh: { label: "Fresh", color: "green" },
    active: { label: "Active", color: "blue" },
    aging: { label: "Idle", color: "yellow" },
    stale: { label: "Stale", color: "red" }
  };
  
  const mapped = statusMap[status] || { label: "Unknown", color: "gray" };
  
  return {
    label: mapped.label,
    color: mapped.color,
    days: daysSinceAction
  };
}