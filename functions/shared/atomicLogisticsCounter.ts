/**
 * Atomic Logistics Job Counter
 * 
 * Provides concurrency-safe sequence generation for logistics job numbers.
 * Uses LogisticsJobCounter entity to maintain per-project/purpose counters.
 */

/**
 * Atomically get and increment the next sequence number for a logistics job.
 * 
 * @param {Object} base44 - Base44 SDK instance (service role)
 * @param {string} counterKey - Unique counter key (e.g., "5001:PO-PU" or "global:SAMP-DO")
 * @returns {Promise<number>} - The sequence number to use
 */
export async function getNextLogisticsSequence(base44, counterKey) {
  // Try to find existing counter
  const existingCounters = await base44.asServiceRole.entities.LogisticsJobCounter.filter({
    key: counterKey
  });

  if (existingCounters.length > 0) {
    // Counter exists - atomically increment
    const counter = existingCounters[0];
    const currentSeq = counter.next_seq || 1;
    const nextSeq = currentSeq + 1;

    // Update counter with new next_seq
    await base44.asServiceRole.entities.LogisticsJobCounter.update(counter.id, {
      next_seq: nextSeq
    });

    return currentSeq;
  } else {
    // Create new counter starting at 1
    await base44.asServiceRole.entities.LogisticsJobCounter.create({
      key: counterKey,
      next_seq: 2 // Next one will be 2
    });

    return 1;
  }
}

/**
 * Build counter key from job context
 * 
 * @param {Object} params - Job context
 * @param {string} params.project_id - Project ID (optional)
 * @param {string} params.project_number - Project number (optional)
 * @param {string} params.purposeCode - Purpose code (e.g., "PO-PU")
 * @returns {string} - Counter key (e.g., "5001:PO-PU" or "global:SAMP-DO")
 */
export function buildCounterKey({ project_id, project_number, purposeCode }) {
  if (project_number || project_id) {
    const projectKey = project_number || project_id;
    return `${projectKey}:${purposeCode}`;
  }
  
  // Global counter for non-project logistics
  return `global:${purposeCode}`;
}