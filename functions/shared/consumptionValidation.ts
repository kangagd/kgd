/**
 * StockConsumption Validation & Reconciliation Rules
 * 
 * Enforces invariants and auto-reconciles allocation status
 */

interface ValidationContext {
  consumption: any;
  allocation?: any;
  visit?: any;
  existingConsumptions: any[];
  isAdmin: boolean;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate consumption creation rules
 */
export async function validateConsumptionCreation(
  base44: any,
  consumptionData: any,
  user: any
): Promise<ValidationResult> {
  const isAdmin = user?.role === 'admin';
  
  // Rule 1: Must include project_id
  if (!consumptionData.project_id) {
    return { valid: false, error: 'project_id is required' };
  }

  // Rule 2: Must include visit_id if visit exists
  if (consumptionData.visit_id) {
    try {
      const visit = await base44.entities.Visit.get(consumptionData.visit_id);
      
      // Optional: Check-in guard (admin can override)
      if (!isAdmin && visit.status !== 'in_progress') {
        return { 
          valid: false, 
          error: 'Visit must be checked-in to record consumption (admin can override)' 
        };
      }
    } catch (error) {
      return { valid: false, error: 'Invalid visit_id' };
    }
  }

  // Rule 3: If source_allocation_id provided, validate allocation
  if (consumptionData.source_allocation_id) {
    try {
      const allocation = await base44.entities.StockAllocation.get(consumptionData.source_allocation_id);
      
      // 3a: Must belong to same project
      if (allocation.project_id !== consumptionData.project_id) {
        return { 
          valid: false, 
          error: 'Allocation does not belong to the same project' 
        };
      }

      // 3b: If allocation has visit_id, must match consumption visit_id
      if (allocation.visit_id && allocation.visit_id !== consumptionData.visit_id) {
        return { 
          valid: false, 
          error: 'Allocation visit_id does not match consumption visit_id' 
        };
      }

      // 3c: Status must not be released
      if (allocation.status === 'released') {
        return { 
          valid: false, 
          error: 'Cannot consume from released allocation' 
        };
      }

      // 3d: Check remaining quantity
      const existingConsumptions = await base44.entities.StockConsumption.filter({
        source_allocation_id: allocation.id
      });
      
      const totalConsumed = existingConsumptions.reduce(
        (sum: number, c: any) => sum + (c.qty_consumed || 0), 
        0
      );
      const remaining = allocation.qty_allocated - totalConsumed;
      
      if (consumptionData.qty_consumed > remaining) {
        return { 
          valid: false, 
          error: `Consumption qty (${consumptionData.qty_consumed}) exceeds remaining allocation (${remaining}/${allocation.qty_allocated})` 
        };
      }
    } catch (error) {
      return { valid: false, error: 'Invalid source_allocation_id' };
    }
  }

  return { valid: true };
}

/**
 * Reconcile allocation status after consumption
 * 
 * Auto-updates allocation status to 'consumed' when fully used
 */
export async function reconcileAllocationAfterConsumption(
  base44: any,
  allocationId: string,
  user: any
): Promise<void> {
  const allocation = await base44.entities.StockAllocation.get(allocationId);
  
  // Get all consumptions for this allocation
  const consumptions = await base44.entities.StockConsumption.filter({
    source_allocation_id: allocationId
  });
  
  const totalConsumed = consumptions.reduce(
    (sum: number, c: any) => sum + (c.qty_consumed || 0), 
    0
  );
  const remaining = allocation.qty_allocated - totalConsumed;

  // If fully consumed, mark allocation as consumed
  if (remaining <= 0 && allocation.status !== 'consumed') {
    await base44.entities.StockAllocation.update(allocationId, {
      status: 'consumed',
      consumed_at: new Date().toISOString(),
      consumed_by_user_id: user?.id || null,
      consumed_by_name: user?.full_name || user?.email || 'System'
    });
  }
}

/**
 * Helper: Get remaining qty for allocation
 */
export async function getAllocationRemainingQty(
  base44: any,
  allocationId: string
): Promise<number> {
  const allocation = await base44.entities.StockAllocation.get(allocationId);
  
  const consumptions = await base44.entities.StockConsumption.filter({
    source_allocation_id: allocationId
  });
  
  const totalConsumed = consumptions.reduce(
    (sum: number, c: any) => sum + (c.qty_consumed || 0), 
    0
  );
  
  return allocation.qty_allocated - totalConsumed;
}