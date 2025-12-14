import { computeFreshness } from "./computeFreshness";

/**
 * Get the effective opened date for a project
 * @param {Object} project - Project object
 * @returns {string|null} - ISO date string
 */
export function getProjectEffectiveOpenedDate(project) {
  return project?.opened_date || project?.created_date || null;
}

/**
 * Calculate project age/freshness based on last activity
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