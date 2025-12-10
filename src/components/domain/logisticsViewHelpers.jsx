/**
 * Logistics View Helpers
 * Pure functions to organize Purchase Orders, Jobs, and Parts for the Logistics Board
 */

import { PO_STATUS, PART_STATUS, LOGISTICS_JOB_TYPE_NAME } from "./logisticsConfig";

/**
 * Filters purchase orders that are relevant for logistics tracking
 * @param {Array} purchaseOrders - Array of PO records
 * @returns {Array} Filtered POs in Sent, Acknowledged, In Transit, or Arrived status
 */
export function getIncomingPurchaseOrders(purchaseOrders) {
  if (!Array.isArray(purchaseOrders)) return [];

  const relevantStatuses = [
    PO_STATUS.SENT,
    PO_STATUS.CONFIRMED,
    PO_STATUS.DELIVERED,
    PO_STATUS.READY_TO_PICK_UP,
    PO_STATUS.DELIVERED_TO_DELIVERY_BAY,
  ];

  const filtered = purchaseOrders.filter(po => 
    relevantStatuses.includes(po.status)
  );

  // Sort by created_at descending if available
  return filtered.sort((a, b) => {
    if (!a.created_date || !b.created_date) return 0;
    return new Date(b.created_date) - new Date(a.created_date);
  });
}

/**
 * Filters parts that are currently in the loading bay
 * @param {Array} parts - Array of part records
 * @returns {Array} Parts with status IN_LOADING_BAY
 */
export function getLoadingBayParts(parts) {
  if (!Array.isArray(parts)) return [];

  return parts.filter(part => 
    part.status === PART_STATUS.IN_LOADING_BAY
  );
}

/**
 * Groups logistics jobs by their status
 * @param {Array} jobs - Array of job records
 * @returns {Object} Jobs grouped by status: { open, scheduled, in_progress, completed }
 */
export function getLogisticsJobs(jobs) {
  if (!Array.isArray(jobs)) {
    return {
      open: [],
      scheduled: [],
      in_progress: [],
      completed: [],
    };
  }

  // Filter to only logistics jobs
  const logisticsJobs = jobs.filter(job => {
    const jobTypeName = job.job_type_name || job.job_type || job.job_type?.name;
    return jobTypeName === LOGISTICS_JOB_TYPE_NAME;
  });

  // Group by status
  const grouped = {
    open: [],
    scheduled: [],
    in_progress: [],
    completed: [],
  };

  logisticsJobs.forEach(job => {
    const status = job.status;
    
    switch (status) {
      case "Open":
        grouped.open.push(job);
        break;
      case "Scheduled":
        grouped.scheduled.push(job);
        break;
      case "In Progress":
        grouped.in_progress.push(job);
        break;
      case "Completed":
        grouped.completed.push(job);
        break;
      default:
        grouped.open.push(job);
    }
  });

  return grouped;
}

/**
 * Calculates summary statistics for the logistics board
 * @param {Array} purchaseOrders - Array of PO records
 * @param {Array} jobs - Array of job records
 * @param {Array} parts - Array of part records
 * @returns {Object} Summary stats: { incomingPOCount, logisticsJobCount, loadingBayPartCount }
 */
export function getLogisticsSummaryStats(purchaseOrders, jobs, parts) {
  const incomingPOs = getIncomingPurchaseOrders(purchaseOrders);
  const logisticsJobsGrouped = getLogisticsJobs(jobs);
  const loadingBayParts = getLoadingBayParts(parts);

  // Count all logistics jobs across all statuses
  const logisticsJobCount = 
    logisticsJobsGrouped.open.length +
    logisticsJobsGrouped.scheduled.length +
    logisticsJobsGrouped.in_progress.length +
    logisticsJobsGrouped.completed.length;

  return {
    incomingPOCount: incomingPOs.length,
    logisticsJobCount,
    loadingBayPartCount: loadingBayParts.length,
  };
}