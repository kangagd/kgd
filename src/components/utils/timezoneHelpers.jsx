/**
 * Timezone helpers for AEST (Australia/Sydney)
 * AEST = UTC+10
 */

const AEST_OFFSET = 10 * 60; // 10 hours in minutes

/**
 * Get current date/time in AEST timezone
 * @returns {Date} Current date in AEST
 */
export const getNowInAEST = () => {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const aestTime = new Date(utcTime + AEST_OFFSET * 60 * 1000);
  return aestTime;
};

/**
 * Format a date as AEST
 * Use with date-fns: format(date, 'yyyy-MM-dd', { locale: enAU })
 */
export const toAEST = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const utcTime = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + AEST_OFFSET * 60 * 1000);
};

/**
 * Check if two dates are the same day in AEST
 */
export const isSameDayAEST = (date1, date2) => {
  const d1 = toAEST(date1);
  const d2 = toAEST(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Check if a date is today in AEST
 */
export const isTodayAEST = (date) => {
  return isSameDayAEST(date, getNowInAEST());
};