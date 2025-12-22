/**
 * Centralized query invalidation helpers
 * Bundles related invalidations to ensure consistency
 */

import { projectKeys } from './queryKeys';

/**
 * Invalidate all purchase order related queries
 * @param {QueryClient} queryClient - React Query client instance
 * @param {string} poId - Purchase Order ID
 */
export async function invalidatePurchaseOrderBundle(queryClient, poId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
    queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
    queryClient.invalidateQueries({ queryKey: projectKeys.purchaseOrders(poId) }),
  ]);
}

/**
 * Invalidate all project related queries
 * @param {QueryClient} queryClient - React Query client instance
 * @param {string} projectId - Project ID
 */
export async function invalidateProjectBundle(queryClient, projectId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    queryClient.invalidateQueries({ queryKey: projectKeys.parts(projectId) }),
  ]);
}