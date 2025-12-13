/**
 * Get the effective opened date for a project
 * @param {Object} project - Project object
 * @returns {string|null} - ISO date string
 */
export function getProjectEffectiveOpenedDate(project) {
  return project?.opened_date || project?.created_date || null;
}

/**
 * Calculate project age/freshness based on opened date
 * @param {Object} project - Project object
 * @returns {Object} { label: string, color: string, days: number }
 */
export function getProjectFreshnessBadge(project) {
  const effectiveOpenedDate = getProjectEffectiveOpenedDate(project);
  
  if (!effectiveOpenedDate) {
    return { label: "Unknown", color: "gray", days: null };
  }

  const openedDate = typeof effectiveOpenedDate === 'string' 
    ? new Date(effectiveOpenedDate) 
    : effectiveOpenedDate;
  
  const today = new Date();
  const diffTime = today.getTime() - openedDate.getTime();
  const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let result;
  if (ageDays <= 3) {
    result = { label: "Fresh", color: "green", days: ageDays };
  } else if (ageDays <= 14) {
    result = { label: "Active", color: "blue", days: ageDays };
  } else if (ageDays <= 30) {
    result = { label: "Idle", color: "yellow", days: ageDays };
  } else {
    result = { label: "Stale", color: "red", days: ageDays };
  }
  
  return result;
}