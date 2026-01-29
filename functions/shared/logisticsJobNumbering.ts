
// Logistics Job Numbering Utility (Backend Version)
// Format: #<project_number>-<purposeCode> or #<project_number>-<purposeCode>-<n> for multiples
// Fallback (no project): #LOG-<purposeCode>-<shortId>

const PURPOSE_CODES = {
  po_delivery_to_warehouse: 'PO-DEL',
  po_pickup_from_supplier: 'PO-PU',
  part_pickup_for_install: 'PART-PU',
  manual_client_dropoff: 'DROP',
  sample_dropoff: 'SAMP-DO',
  sample_pickup: 'SAMP-PU',
};

export function getPurposeCode(logisticsPurpose) {
  return PURPOSE_CODES[logisticsPurpose] || 'LOG';
}

export function buildLogisticsJobNumber({ projectNumber, purposeCode, sequence = 1, fallbackShortId }) {
  if (!projectNumber) {
    return `LOG-${purposeCode}-${fallbackShortId}`;
  }
  
  if (sequence === 1) {
    return `${projectNumber}-${purposeCode}`;
  }
  
  return `${projectNumber}-${purposeCode}-${sequence}`;
}

export function isLogisticsJobNumber(jobNumber) {
  if (!jobNumber) return false;
  const str = String(jobNumber);

  // Project-linked logistics:
  //   1234-PO-PU
  //   1234-PO-PU-2
  const projectPattern = /^\d+-[A-Z]+-[A-Z]+(-\d+)?$/;

  // No-project logistics fallback:
  //   LOG-PO-PU-abc123
  const noProjectPattern = /^LOG-[A-Z]+-[A-Z]+-[A-Za-z0-9]{3,}$/;

  return projectPattern.test(str) || noProjectPattern.test(str);
}

export function getNextSequence(existingJobs, projectNumber, purposeCode) {
  const base = `${projectNumber}-${purposeCode}`;
  const pattern = new RegExp(`^${base}(-\\d+)?$`);
  
  const sequences = existingJobs
    .map(job => String(job.job_number || ''))
    .filter(num => pattern.test(num))
    .map(num => {
      if (num === base) return 1;
      const match = num.match(new RegExp(`^${base}-(\\d+)$`));
      return match ? parseInt(match[1], 10) : 1;
    });
  
  return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}
