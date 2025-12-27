/**
 * Centralized query invalidation helpers
 * Bundles related invalidations to ensure consistency
 *
 * REMOVED: Purchase Order invalidation helpers (HARD RESET - 2025-12-27)
 * KEPT: Project invalidation helpers
 */

import { projectKeys } from './queryKeys';

/**
 * Invalidate all project related queries
 * @param {QueryClient} queryClient - React Query client instance
 * @param {string} projectId - Project ID
 */
export async function invalidateProjectBundle(queryClient, projectId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  ]);
}