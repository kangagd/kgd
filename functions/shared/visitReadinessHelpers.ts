/**
 * Visit Readiness Calculation
 * 
 * Determines if a visit is ready to proceed based on blocking requirements
 * and allocated stock.
 */

export type VisitReadinessStatus = 'not_ready' | 'ready_to_pack' | 'ready_to_install';

export interface VisitReadinessSummary {
  status: VisitReadinessStatus;
  blocking_lines: {
    requirement_line_id: string;
    description: string;
    qty_required: number;
    qty_allocated: number;
    qty_loaded: number;
    is_covered: boolean;
    is_loaded: boolean;
  }[];
  total_blocking: number;
  covered_count: number;
  loaded_count: number;
}

/**
 * Compute visit readiness from requirements and allocations
 * 
 * @param visitId - The visit to check
 * @param requirements - Project requirement lines (blocking only)
 * @param allocations - Stock allocations for this visit
 * @returns Readiness summary
 */
export async function computeVisitReadiness(
  visitId: string,
  requirements: any[],
  allocations: any[]
): Promise<VisitReadinessSummary> {
  // Filter to blocking requirements only
  const blockingReqs = requirements.filter(req => 
    req.is_blocking === true && 
    req.status !== 'cancelled'
  );

  const blockingLines = blockingReqs.map(req => {
    // Filter allocations for this requirement + visit
    const reqAllocations = allocations.filter(alloc => 
      alloc.requirement_line_id === req.id &&
      alloc.visit_id === visitId &&
      ['reserved', 'loaded', 'consumed'].includes(alloc.status)
    );

    const qtyAllocated = reqAllocations.reduce((sum, alloc) => sum + (alloc.qty_allocated || 0), 0);
    
    const loadedAllocations = reqAllocations.filter(alloc => 
      ['loaded', 'consumed'].includes(alloc.status)
    );
    const qtyLoaded = loadedAllocations.reduce((sum, alloc) => sum + (alloc.qty_allocated || 0), 0);

    const isCovered = qtyAllocated >= req.qty_required;
    const isLoaded = qtyLoaded >= req.qty_required;

    return {
      requirement_line_id: req.id,
      description: req.description || req.catalog_item_name || 'Item',
      qty_required: req.qty_required,
      qty_allocated: qtyAllocated,
      qty_loaded: qtyLoaded,
      is_covered: isCovered,
      is_loaded: isLoaded
    };
  });

  const totalBlocking = blockingLines.length;
  const coveredCount = blockingLines.filter(line => line.is_covered).length;
  const loadedCount = blockingLines.filter(line => line.is_loaded).length;

  let status: VisitReadinessStatus = 'not_ready';
  
  if (totalBlocking === 0) {
    // No blocking requirements → ready to install
    status = 'ready_to_install';
  } else if (loadedCount === totalBlocking) {
    // All blocking requirements loaded
    status = 'ready_to_install';
  } else if (coveredCount === totalBlocking) {
    // All blocking requirements allocated but not all loaded
    status = 'ready_to_pack';
  } else {
    // Some blocking requirements not covered
    status = 'not_ready';
  }

  return {
    status,
    blocking_lines: blockingLines,
    total_blocking: totalBlocking,
    covered_count: coveredCount,
    loaded_count: loadedCount
  };
}

/**
 * Get a user-friendly label for readiness status
 */
export function getReadinessLabel(status: VisitReadinessStatus): string {
  switch (status) {
    case 'not_ready':
      return 'Not Ready';
    case 'ready_to_pack':
      return 'Ready to Pack';
    case 'ready_to_install':
      return 'Ready to Install';
    default:
      return 'Unknown';
  }
}

/**
 * Get badge color variant for readiness status
 */
export function getReadinessBadgeVariant(status: VisitReadinessStatus): string {
  switch (status) {
    case 'not_ready':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'ready_to_pack':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'ready_to_install':
      return 'bg-green-100 text-green-700 border-green-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}