/**
 * Centralized query invalidation helpers
 * Bundles related invalidations to ensure consistency
 */

import { queryKeys } from './queryKeys';

/**
 * Invalidate all purchase order related queries
 * @param {QueryClient} queryClient - React Query client instance
 * @param {string} poId - Purchase Order ID
 */
export async function invalidatePurchaseOrderBundle(queryClient, poId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrder(poId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrderLines(poId) }),
  ]);
}

/**
 * Invalidate all project related queries
 * @param {QueryClient} queryClient - React Query client instance
 * @param {string} projectId - Project ID
 */
export async function invalidateProjectBundle(queryClient, projectId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
    queryClient.invalidateQueries({ queryKey: ['projectParts', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectParts'] }),
  ]);
}