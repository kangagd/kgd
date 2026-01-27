/**
 * Logistics Job Numbering - Single Source of Truth
 * 
 * Format rules:
 * - Primary: #<project_number>-<purposeCode>
 * - Multiple same purpose: #<project_number>-<purposeCode>-<n>
 * - No project: #LOG-<purposeCode>-<shortId>
 * 
 * Must NOT use A/B/C suffix scheme
 * Must be stable and idempotent
 */

/**
 * Map logistics_purpose enum values to short codes
 */
export function getPurposeCode(logistics_purpose) {
  const mapping = {
    'po_delivery_to_warehouse': 'PO-DEL',
    'po_pickup_from_supplier': 'PO-PU',
    'part_pickup_for_install': 'PART-PU',
    'manual_client_dropoff': 'DROP',
    'sample_dropoff': 'SAMP-DO',
    'sample_pickup': 'SAMP-PU',
  };
  
  return mapping[logistics_purpose] || 'LOG';
}

/**
 * Extract project number from job data
 * Priority: job.project_id -> PO.project_id
 */
export function getProjectNumberForJob(job, purchaseOrder = null) {
  // Direct project link
  if (job.project_number) {
    return String(job.project_number);
  }
  
  // Via PO
  if (purchaseOrder?.project_number) {
    return String(purchaseOrder.project_number);
  }
  
  return null;
}

/**
 * Build logistics job number
 * @param {Object} params
 * @param {string|null} params.projectNumber - Project number (nullable)
 * @param {string} params.purposeCode - Purpose code (e.g., 'PO-PU')
 * @param {number|null} params.sequence - Sequence number (1 = no suffix, 2+)
 * @param {string|null} params.fallbackShortId - Short ID for fallback (when no project)
 * @returns {string} Job number (e.g., '1234-PO-PU', '1234-PO-PU-2', 'LOG-SAMP-DO-abc123')
 */
export function buildLogisticsJobNumber({ projectNumber, purposeCode, sequence = null, fallbackShortId = null }) {
  // Has project
  if (projectNumber) {
    const base = `${projectNumber}-${purposeCode}`;
    
    // First of this type: no suffix
    if (!sequence || sequence === 1) {
      return base;
    }
    
    // Second+: add suffix
    return `${base}-${sequence}`;
  }
  
  // No project: fallback format
  const shortId = fallbackShortId || Math.random().toString(36).substring(2, 8);
  return `LOG-${purposeCode}-${shortId}`;
}

/**
 * Check if job number matches logistics pattern
 * @param {string} jobNumber - Job number to check
 * @returns {boolean} True if matches logistics pattern
 */
export function isLogisticsJobNumber(jobNumber) {
  if (!jobNumber) return false;
  
  const str = String(jobNumber);
  
  // Pattern 1: #<number>-<PURPOSE>
  // Pattern 2: #<number>-<PURPOSE>-<seq>
  // Pattern 3: LOG-<PURPOSE>-<shortId>
  const patterns = [
    /^\d+-[A-Z]+-[A-Z]+$/,           // 1234-PO-PU
    /^\d+-[A-Z]+-[A-Z]+-\d+$/,       // 1234-PO-PU-2
    /^LOG-[A-Z]+-[A-Z]+-[a-z0-9]+$/  // LOG-SAMP-DO-abc123
  ];
  
  return patterns.some(pattern => pattern.test(str));
}

/**
 * Calculate next sequence number for a given project + purpose
 * @param {Array} existingJobs - All logistics jobs (with correct numbers only)
 * @param {string} projectNumber - Project number
 * @param {string} purposeCode - Purpose code
 * @returns {number} Next sequence (1 for first, 2+ for subsequent)
 */
export function getNextSequence(existingJobs, projectNumber, purposeCode) {
  const basePattern = `${projectNumber}-${purposeCode}`;
  
  const matchingJobs = existingJobs.filter(j => {
    const num = String(j.job_number || '');
    return num === basePattern || num.startsWith(`${basePattern}-`);
  });
  
  if (matchingJobs.length === 0) {
    return 1; // First one
  }
  
  // Find highest sequence
  const sequences = matchingJobs.map(j => {
    const num = String(j.job_number);
    if (num === basePattern) return 1;
    
    const match = num.match(new RegExp(`^${basePattern}-(\\d+)$`));
    return match ? parseInt(match[1], 10) : 1;
  });
  
  return Math.max(...sequences) + 1;
}