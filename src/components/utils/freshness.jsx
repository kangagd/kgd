/**
 * Calculate project freshness based on last activity
 * @param {string|Date} lastActivityAt - Last activity timestamp
 * @returns {Object} { label: string, color: string, days: number }
 */
export function getProjectFreshnessBadge(lastActivityAt) {
  if (!lastActivityAt) {
    return { label: "Unknown", color: "gray", days: null };
  }

  const lastActivity = typeof lastActivityAt === 'string' 
    ? new Date(lastActivityAt) 
    : lastActivityAt;
  
  const today = new Date();
  const diffTime = today.getTime() - lastActivity.getTime();
  const freshness_days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (freshness_days <= 3) {
    return { label: "Fresh", color: "green", days: freshness_days };
  } else if (freshness_days <= 14) {
    return { label: "Active", color: "blue", days: freshness_days };
  } else if (freshness_days <= 30) {
    return { label: "Idle", color: "yellow", days: freshness_days };
  } else {
    return { label: "Stale", color: "red", days: freshness_days };
  }
}