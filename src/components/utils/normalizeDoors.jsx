/**
 * Normalizes door measurements from a measurements object.
 * Supports both legacy single-door (measurements.new_door) and new multi-door (measurements.new_doors) schemas.
 * 
 * @param {object} measurements - The measurements object from a Job or Project.
 * @returns {Array<object>} An array of door objects, or an empty array if no valid door data is found.
 */
export function normalizeDoors(measurements) {
  if (!measurements) {
    return [];
  }

  // New multi-door schema (preferred)
  if (Array.isArray(measurements.new_doors) && measurements.new_doors.length > 0) {
    return measurements.new_doors;
  }

  // Legacy single-door schema
  if (measurements.new_door && typeof measurements.new_door === 'object' && Object.keys(measurements.new_door).length > 0) {
    return [measurements.new_door];
  }

  return [];
}