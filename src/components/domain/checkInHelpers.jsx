/**
 * Helper functions for working with CheckInOut records.
 * Used to identify active check-ins and map them to jobs.
 */

/**
 * Builds a map of job IDs to their active check-ins.
 * Filters out check-ins that have a check_out_time.
 * 
 * @param {Array} checkIns - Array of CheckInOut records
 * @returns {Object} Map keyed by job_id: { [jobId]: { jobId, checkIns: [...] } }
 */
export const buildActiveCheckInMap = (checkIns) => {
  if (!checkIns || !Array.isArray(checkIns) || checkIns.length === 0) {
    return {};
  }

  const activeMap = {};

  checkIns.forEach((checkIn) => {
    // Active check-in means check_out_time is null, undefined, or empty string
    if (!checkIn.check_out_time) {
      const jobId = checkIn.job_id;
      
      if (jobId) {
        if (!activeMap[jobId]) {
          activeMap[jobId] = {
            jobId,
            checkIns: []
          };
        }
        activeMap[jobId].checkIns.push(checkIn);
      }
    }
  });

  return activeMap;
};

/**
 * Retrieves the array of active check-ins for a specific job.
 * 
 * @param {string|number} jobId - The ID of the job
 * @param {Object} activeMap - The map returned by buildActiveCheckInMap
 * @returns {Array} Array of active check-in records, or empty array if none
 */
export const getActiveCheckInsForJob = (jobId, activeMap) => {
  if (!jobId || !activeMap || !activeMap[jobId]) {
    return [];
  }
  return activeMap[jobId].checkIns || [];
};

/**
 * Checks if a job has at least one active check-in.
 * 
 * @param {string|number} jobId - The ID of the job
 * @param {Object} activeMap - The map returned by buildActiveCheckInMap
 * @returns {boolean} True if there are active check-ins, false otherwise
 */
export const hasActiveCheckIn = (jobId, activeMap) => {
  const checkIns = getActiveCheckInsForJob(jobId, activeMap);
  return checkIns.length > 0;
};