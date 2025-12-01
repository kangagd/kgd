/**
 * Helper functions for calculating SLA age and formatting labels.
 */

/**
 * Calculate the number of whole days between a date and today.
 * @param {string|Date|null} dateValue - The date to calculate age from
 * @returns {number|null} Number of days (>= 0) or null if invalid date
 */
export const getAgeInDays = (dateValue) => {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now - date;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
};

/**
 * Bucket an age in days into predefined categories.
 * @param {number|null} ageInDays - The age in days
 * @returns {string} One of: 'new', 'warm', 'aging', 'old', 'stale', 'unknown'
 */
export const getAgeBucket = (ageInDays) => {
  if (ageInDays === null || isNaN(ageInDays) || typeof ageInDays !== 'number') return 'unknown';
  
  if (ageInDays <= 7) return 'new';
  if (ageInDays <= 14) return 'warm';
  if (ageInDays <= 30) return 'aging';
  if (ageInDays <= 60) return 'old';
  return 'stale';
};

/**
 * Generate a human-readable label for the age of a date.
 * @param {string|Date|null} dateValue - The date to process
 * @returns {Object} { ageInDays, bucket, label }
 */
export const getAgeLabel = (dateValue) => {
  const ageInDays = getAgeInDays(dateValue);
  const bucket = getAgeBucket(ageInDays);
  
  if (bucket === 'unknown') {
    return { ageInDays: null, bucket, label: 'Unknown age' };
  }

  const dayLabel = ageInDays === 1 ? 'day' : 'days';
  const basePart = `${ageInDays} ${dayLabel}`;
  
  let prefix = '';
  switch (bucket) {
    case 'new':
      prefix = 'New';
      break;
    case 'warm':
      prefix = 'Recent';
      break;
    case 'aging':
      prefix = 'Aging';
      break;
    case 'old':
      prefix = 'Old';
      break;
    case 'stale':
      prefix = 'Stale';
      break;
    default:
      prefix = 'Unknown';
  }

  return {
    ageInDays,
    bucket,
    label: `${prefix} · ${basePart}`
  };
};