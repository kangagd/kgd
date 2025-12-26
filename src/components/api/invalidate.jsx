
/**
 * Centralized query invalidation helpers
 * Bundles related invalidations to ensure consistency
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
