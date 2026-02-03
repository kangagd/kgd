import { base44 } from '@/api/base44Client';

/**
 * Compute visit readiness based on:
 * - ProjectRequirementLine (blocking)
 * - StockAllocation status (reserved/loaded)
 * - Open receipts in loading bay
 */
export async function computeVisitReadiness({ visitId, projectId }) {
  if (!projectId) {
    return {
      status: 'Unknown',
      missing_blocking: 0,
      packed: false,
      loading_bay_receipts: 0,
      details: []
    };
  }

  // Fetch blocking requirements
  const requirements = await base44.entities.ProjectRequirementLine.filter({
    project_id: projectId,
    is_blocking: true
  });

  // Fetch all allocations for this project
  const allocations = await base44.entities.StockAllocation.filter({
    project_id: projectId
  });

  // Fetch open receipts in loading bay for this project
  const openReceipts = await base44.entities.Receipt.filter({
    project_id: projectId,
    status: 'open'
  });

  let missing_blocking = 0;
  const details = [];

  // Check each blocking requirement
  for (const req of requirements) {
    const relatedAllocations = allocations.filter(
      a => a.requirement_line_id === req.id && a.status !== 'released'
    );
    
    const allocatedQty = relatedAllocations.reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
    const requiredQty = req.qty_required || 0;

    if (allocatedQty < requiredQty) {
      missing_blocking++;
      details.push({
        requirement_id: req.id,
        description: req.description,
        required: requiredQty,
        allocated: allocatedQty,
        missing: requiredQty - allocatedQty
      });
    }
  }

  // Check if visit-specific allocations are packed (loaded)
  let packed = false;
  if (visitId) {
    const visitAllocations = allocations.filter(a => a.visit_id === visitId);
    const visitBlockingAllocations = visitAllocations.filter(a => {
      // Check if this allocation is for a blocking requirement
      const req = requirements.find(r => r.id === a.requirement_line_id);
      return req && req.is_blocking;
    });

    // If there are blocking allocations for this visit, check if all are loaded
    if (visitBlockingAllocations.length > 0) {
      packed = visitBlockingAllocations.every(a => a.status === 'loaded');
    }
  }

  // Determine status
  let status = 'Ready + Packed';
  if (missing_blocking > 0) {
    status = 'Not Ready';
  } else if (!packed) {
    status = 'Ready (Not Packed)';
  }

  return {
    status,
    missing_blocking,
    packed,
    loading_bay_receipts: openReceipts.length,
    details
  };
}